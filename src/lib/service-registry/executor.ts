// ============================================================
// Service Executor — credential pool selection + fail-over
// ============================================================
// Usage:
//   const result = await serviceExecutor.execute({
//     toolCode: 'pdf-compress',
//     capability: 'pdf.compress',
//     payload,
//   }, async (credential, overrides) => { ... });
// ============================================================

import { authClient } from '@/lib/authClient';
import type {
  ServiceCredential,
  ToolServiceBinding,
  ServiceProfile,
  CredentialWithSecret,
  BindingOverrides,
  SelectionStrategy,
} from './types';
import { filterAvailable, selectCredential } from './strategies';
import { loadLegacyCredentials } from './legacy-fallback';

export interface ExecutorOptions {
  toolCode: string;
  capability: string;
}

export type ExecutorCallback<T> = (
  credential: CredentialWithSecret,
  overrides: BindingOverrides,
) => Promise<T>;

export interface ExecutorResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  credentialId?: string;
  providerId?: string;
  failoverAttempts: number;
}

/**
 * Main executor: resolve bindings → select credential → execute → failover.
 * Pre-checks quota (credit pool) before attempting API call.
 */
export async function execute<T>(
  options: ExecutorOptions,
  callback: ExecutorCallback<T>,
): Promise<ExecutorResult<T>> {
  const { toolCode, capability } = options;
  let failoverAttempts = 0;

  // 0. Pre-check credit quota (if pool exists for this tool's provider)
  const quotaCheck = await preCheckQuota(toolCode, capability);
  if (quotaCheck && !quotaCheck.allowed) {
    return {
      success: false,
      error: `Quota exhausted: ${quotaCheck.exhaustedWindows?.join(', ') ?? 'unknown window'}. Retry after ${quotaCheck.retryAfter ?? 'unknown'}`,
      failoverAttempts: 0,
    };
  }

  // 1. Load bindings for tool+capability, sorted by priority
  const bindings = await loadBindings(toolCode, capability);

  if (bindings.length === 0) {
    // Try auto-binding from required_capabilities
    const autoBindings = await tryAutoBindFromCapabilities(toolCode, capability);
    if (autoBindings.length > 0) {
      // Retry with newly created bindings
      const retryBindings = await loadBindings(toolCode, capability);
      if (retryBindings.length > 0) {
        return executeWithBindings(retryBindings, callback, failoverAttempts);
      }
    }

    // Try legacy fallback
    const legacy = await loadLegacyCredentials(toolCode, capability);
    if (legacy && legacy.credentials.length > 0) {
      return executeWithCredentials(legacy.credentials, legacy.overrides, callback, failoverAttempts);
    }
    return { success: false, error: `No bindings found for ${toolCode}/${capability}`, failoverAttempts: 0 };
  }

  // 2. Iterate bindings by priority (primary first, then fallbacks)
  for (const binding of bindings) {
    if (!binding.enabled || !binding.profile_id) continue;
    failoverAttempts++;

    const profile = await loadProfile(binding.profile_id);
    if (!profile || profile.status !== 'active') continue;

    const credentials = await loadCredentials(binding.profile_id);
    const available = filterAvailable(credentials);

    if (available.length === 0) {
      // Try legacy if this is the only binding
      continue;
    }

    const strategy: SelectionStrategy = profile.settings_json?.keySelectionStrategy ?? 'priority';
    const overrides: BindingOverrides = binding.overrides_json ?? {};

    // Try credentials within this binding's pool
    const triedIds = new Set<string>();
    let attempts = 0;
    const maxAttempts = available.length;

    while (attempts < maxAttempts) {
      const remaining = available.filter((c) => !triedIds.has(c.id));
      const selected = selectCredential(remaining, strategy, profile.id);
      if (!selected) break;

      triedIds.add(selected.id);
      attempts++;

      const credWithSecret: CredentialWithSecret = {
        id: selected.id,
        identifier: selected.identifier,
        secret_data_json: selected.secret_data_json ?? {},
        priority: selected.priority,
        weight: selected.weight,
      };

      try {
        const result = await callback(credWithSecret, overrides);
        // Success — update stats
        await updateCredentialSuccess(selected.id);
        return {
          success: true,
          data: result,
          credentialId: selected.id,
          providerId: profile.provider_id,
          failoverAttempts,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit = isRateLimitError(errMsg);
        const isQuotaExceeded = isQuotaError(errMsg);

        if (isRateLimit || isQuotaExceeded) {
          await updateCredentialFailure(selected.id, errMsg, isQuotaExceeded);
        } else {
          // Non-retriable error — propagate immediately
          await updateCredentialFailure(selected.id, errMsg, false);
          return {
            success: false,
            error: errMsg,
            credentialId: selected.id,
            failoverAttempts,
          };
        }
      }
    }
    // All credentials in this pool exhausted, try next binding (fallback)
  }

  // 3. All bindings exhausted — try legacy as last resort
  const legacy = await loadLegacyCredentials(toolCode, capability);
  if (legacy && legacy.credentials.length > 0) {
    return executeWithCredentials(legacy.credentials, legacy.overrides, callback, failoverAttempts);
  }

  return {
    success: false,
    error: `All credentials exhausted for ${toolCode}/${capability}`,
    failoverAttempts,
  };
}

async function executeWithCredentials<T>(
  credentials: CredentialWithSecret[],
  overrides: BindingOverrides,
  callback: ExecutorCallback<T>,
  failoverAttempts: number,
): Promise<ExecutorResult<T>> {
  for (const cred of credentials) {
    try {
      const result = await callback(cred, overrides);
      return { success: true, data: result, credentialId: cred.id, failoverAttempts };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!isRateLimitError(errMsg) && !isQuotaError(errMsg)) {
        return { success: false, error: errMsg, credentialId: cred.id, failoverAttempts };
      }
      // Rate limit / quota — try next
    }
  }
  return { success: false, error: 'All legacy credentials failed', failoverAttempts };
}

// ─── DB helpers ─────────────────────────────────────────────

async function loadBindings(toolCode: string, capability: string): Promise<ToolServiceBinding[]> {
  const { data, error } = await authClient
    .from('tool_service_bindings')
    .select('*')
    .eq('tool_code', toolCode)
    .eq('capability', capability)
    .eq('enabled', true)
    .order('is_primary', { ascending: false })
    .order('priority');
  if (error) return [];
  return data ?? [];
}

async function loadProfile(profileId: string): Promise<ServiceProfile | null> {
  const { data, error } = await authClient
    .from('service_profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function loadCredentials(profileId: string): Promise<ServiceCredential[]> {
  const { data, error } = await authClient
    .from('service_credentials')
    .select('*')
    .eq('profile_id', profileId)
    .order('priority');
  if (error) return [];
  return data ?? [];
}

async function updateCredentialSuccess(credId: string): Promise<void> {
  if (credId.startsWith('legacy-')) return; // Don't update legacy pseudo-credentials
  await authClient
    .from('service_credentials')
    .update({
      last_used_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
    })
    .eq('id', credId);
}

async function updateCredentialFailure(
  credId: string,
  errorMessage: string,
  markExhausted: boolean,
): Promise<void> {
  if (credId.startsWith('legacy-')) return;
  const update: Record<string, unknown> = {
    last_used_at: new Date().toISOString(),
    last_error_at: new Date().toISOString(),
    last_error_message: errorMessage.slice(0, 500),
  };
  if (markExhausted) {
    update.status = 'exhausted';
  } else {
    // Cooldown for 60s on rate limit
    update.status = 'cooldown';
    update.cooldown_until = new Date(Date.now() + 60_000).toISOString();
  }
  await authClient.from('service_credentials').update(update).eq('id', credId);
}

// ─── Error classification ───────────────────────────────────

function isRateLimitError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests');
}

function isQuotaError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes('quota') || lower.includes('exhausted') || lower.includes('billing');
}

// ─── Quota pre-check ────────────────────────────────────────

interface QuotaPreCheckResult {
  allowed: boolean;
  retryAfter?: string;
  exhaustedWindows?: string[];
}

/**
 * Pre-check credit quota before executing.
 * Finds credit pool linked to the provider that this tool+capability binds to.
 * Returns null if no pool exists (= no quota constraint, allow freely).
 */
async function preCheckQuota(
  toolCode: string,
  capability: string,
): Promise<QuotaPreCheckResult | null> {
  // Find binding → profile → provider → pool
  const { data: binding } = await authClient
    .from('tool_service_bindings')
    .select('profile_id')
    .eq('tool_code', toolCode)
    .eq('capability', capability)
    .eq('enabled', true)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!binding?.profile_id) return null;

  const { data: profile } = await authClient
    .from('service_profiles')
    .select('provider_id')
    .eq('id', binding.profile_id)
    .maybeSingle();

  if (!profile?.provider_id) return null;

  // Find credit pool for this provider
  const { data: pool } = await authClient
    .from('credit_pools')
    .select('id, code, status')
    .eq('provider_id', profile.provider_id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!pool) return null; // No pool = no quota constraint

  // Check all quota windows
  const { data: quotas } = await authClient
    .from('credit_pool_quotas')
    .select('window_type, used_credits, max_credits, window_end, status')
    .eq('pool_id', pool.id);

  if (!quotas || quotas.length === 0) return null;

  const now = new Date();
  const exhausted: string[] = [];
  let earliestRetry: string | undefined;

  for (const q of quotas) {
    // Skip expired windows (will auto-reset on next checkQuota call)
    if (new Date(q.window_end).getTime() < now.getTime()) continue;

    if (q.used_credits >= q.max_credits) {
      exhausted.push(q.window_type);
      if (!earliestRetry || q.window_end < earliestRetry) {
        earliestRetry = q.window_end;
      }
    }
  }

  if (exhausted.length > 0) {
    return { allowed: false, retryAfter: earliestRetry, exhaustedWindows: exhausted };
  }

  return { allowed: true };
}

// ─── Public API ─────────────────────────────────────────────

export const serviceExecutor = { execute };

// ─── Auto-binding from required_capabilities ────────────────

/**
 * When no binding exists, check if tool has required_capabilities
 * that match the requested capability. If yes, auto-create binding.
 */
async function tryAutoBindFromCapabilities(
  toolCode: string,
  capability: string,
): Promise<ToolServiceBinding[]> {
  // Load tool's required_capabilities
  const { data: tool } = await authClient
    .from('tools')
    .select('required_capabilities')
    .eq('code', toolCode)
    .maybeSingle();

  if (!tool) return [];

  const caps = (tool.required_capabilities ?? []) as Array<{
    capability: string;
    preferred_provider: string;
  }>;

  const match = caps.find((c) => c.capability === capability);
  if (!match) return [];

  // Find provider
  const { data: provider } = await authClient
    .from('service_providers')
    .select('id')
    .eq('code', match.preferred_provider)
    .eq('status', 'active')
    .maybeSingle();

  if (!provider) return [];

  // Find first active profile
  const { data: profile } = await authClient
    .from('service_profiles')
    .select('id')
    .eq('provider_id', provider.id)
    .eq('status', 'active')
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (!profile) return [];

  // Create binding
  const { data: binding } = await authClient
    .from('tool_service_bindings')
    .insert({
      tool_code: toolCode,
      capability,
      profile_id: profile.id,
      is_primary: true,
      priority: 0,
      enabled: true,
    })
    .select('*')
    .maybeSingle();

  return binding ? [binding as ToolServiceBinding] : [];
}

/**
 * Execute with a list of bindings (extracted to reuse after auto-bind).
 */
async function executeWithBindings<T>(
  bindings: ToolServiceBinding[],
  callback: ExecutorCallback<T>,
  failoverAttempts: number,
): Promise<ExecutorResult<T>> {
  for (const binding of bindings) {
    if (!binding.enabled || !binding.profile_id) continue;
    failoverAttempts++;

    const profile = await loadProfile(binding.profile_id);
    if (!profile || profile.status !== 'active') continue;

    const credentials = await loadCredentials(binding.profile_id);
    const available = filterAvailable(credentials);
    if (available.length === 0) continue;

    const strategy: SelectionStrategy = profile.settings_json?.keySelectionStrategy ?? 'priority';
    const overrides: BindingOverrides = binding.overrides_json ?? {};

    const triedIds = new Set<string>();
    let attempts = 0;

    while (attempts < available.length) {
      const remaining = available.filter((c) => !triedIds.has(c.id));
      const selected = selectCredential(remaining, strategy, profile.id);
      if (!selected) break;

      triedIds.add(selected.id);
      attempts++;

      const credWithSecret: CredentialWithSecret = {
        id: selected.id,
        identifier: selected.identifier,
        secret_data_json: selected.secret_data_json ?? {},
        priority: selected.priority,
        weight: selected.weight,
      };

      try {
        const result = await callback(credWithSecret, overrides);
        await updateCredentialSuccess(selected.id);
        return {
          success: true,
          data: result,
          credentialId: selected.id,
          providerId: profile.provider_id,
          failoverAttempts,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (isRateLimitError(errMsg) || isQuotaError(errMsg)) {
          await updateCredentialFailure(selected.id, errMsg, isQuotaError(errMsg));
        } else {
          await updateCredentialFailure(selected.id, errMsg, false);
          return { success: false, error: errMsg, credentialId: selected.id, failoverAttempts };
        }
      }
    }
  }

  return { success: false, error: 'All credentials exhausted', failoverAttempts };
}