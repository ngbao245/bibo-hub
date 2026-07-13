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
 */
export async function execute<T>(
  options: ExecutorOptions,
  callback: ExecutorCallback<T>,
): Promise<ExecutorResult<T>> {
  const { toolCode, capability } = options;
  let failoverAttempts = 0;

  // 1. Load bindings for tool+capability, sorted by priority
  const bindings = await loadBindings(toolCode, capability);

  if (bindings.length === 0) {
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

// ─── Public API ─────────────────────────────────────────────

export const serviceExecutor = { execute };