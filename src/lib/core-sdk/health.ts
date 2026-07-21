// ============================================================
// Core SDK — Health Check (provider-level health assessment)
// ============================================================
// Determines provider health from existing DB data:
//   - credentials status (active, exhausted, cooldown, error, invalid)
//   - credit pool quotas (available, exhausted)
//   - last error/success timestamps
//
// No external API calls — purely database-driven.
// ============================================================

import { useQuery } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';

// ─── Types ──────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'warning' | 'error' | 'disabled' | 'unknown';

export interface ProviderHealth {
  providerCode: string;
  providerName: string;
  status: HealthStatus;
  reason: string;
  details: {
    totalCredentials: number;
    activeCredentials: number;
    errorCredentials: number;
    exhaustedCredentials: number;
    cooldownCredentials: number;
    hasQuota: boolean;
    quotaExhausted: boolean;
    quotaPercentage: number | null;
    lastSuccess: string | null;
    lastError: string | null;
  };
}

export interface SystemHealth {
  overall: HealthStatus;
  providers: ProviderHealth[];
  summary: {
    total: number;
    healthy: number;
    warning: number;
    error: number;
    disabled: number;
  };
}

// ─── Query ──────────────────────────────────────────────────

export const healthKeys = {
  system: ['core-sdk', 'health', 'system'] as const,
};

/**
 * Fetch full system health assessment.
 * Aggregates provider + credential + quota data into health status.
 */
export function useSystemHealth() {
  return useQuery({
    queryKey: healthKeys.system,
    queryFn: fetchSystemHealth,
    staleTime: 30 * 1000, // Refresh every 30s
    refetchInterval: 60 * 1000, // Auto-refetch every 60s
  });
}

// ─── Core logic ─────────────────────────────────────────────

async function fetchSystemHealth(): Promise<SystemHealth> {
  // 1. Load all providers
  const { data: providers } = await authClient
    .from('service_providers')
    .select('id, code, name, status')
    .order('name');

  if (!providers) return emptyHealth();

  // 2. Load all credentials (joined with profile → provider)
  const { data: credentials } = await authClient
    .from('service_credentials')
    .select('id, profile_id, status, last_success_at, last_error_at, last_error_message, cooldown_until')
    .order('profile_id');

  // 3. Load all profiles (to map credential → provider)
  const { data: profiles } = await authClient
    .from('service_profiles')
    .select('id, provider_id, status');

  // 4. Load credit pools + quotas
  const { data: pools } = await authClient
    .from('credit_pools')
    .select('id, provider_id, status');

  const { data: quotas } = await authClient
    .from('credit_pool_quotas')
    .select('id, pool_id, used_credits, max_credits, status');

  // Build lookup maps
  const profileToProvider = new Map<string, string>();
  for (const p of profiles ?? []) {
    profileToProvider.set(p.id, p.provider_id);
  }

  const poolToProvider = new Map<string, string>();
  for (const p of pools ?? []) {
    poolToProvider.set(p.id, p.provider_id);
  }

  // 5. Assess each provider
  const providerHealths: ProviderHealth[] = providers.map((provider) => {
    // Provider disabled by admin
    if (provider.status !== 'active') {
      return {
        providerCode: provider.code,
        providerName: provider.name,
        status: 'disabled' as HealthStatus,
        reason: 'Disabled by admin',
        details: emptyDetails(),
      };
    }

    // Get credentials for this provider
    const providerCreds = (credentials ?? []).filter((c) => {
      const providerId = profileToProvider.get(c.profile_id);
      return providerId === provider.id;
    });

    // Get quota info for this provider
    const providerPools = (pools ?? []).filter((p) => p.provider_id === provider.id);
    const providerQuotas = (quotas ?? []).filter((q) =>
      providerPools.some((p) => p.id === q.pool_id)
    );

    // Credential stats
    const totalCreds = providerCreds.length;
    const activeCreds = providerCreds.filter((c) => c.status === 'active').length;
    const errorCreds = providerCreds.filter((c) => c.status === 'error' || c.status === 'invalid').length;
    const exhaustedCreds = providerCreds.filter((c) => c.status === 'exhausted').length;
    const cooldownCreds = providerCreds.filter((c) => {
      if (c.status !== 'cooldown') return false;
      if (!c.cooldown_until) return false;
      return new Date(c.cooldown_until).getTime() > Date.now();
    }).length;

    // Quota stats
    const hasQuota = providerQuotas.length > 0;
    const quotaExhausted = providerQuotas.some((q) => q.status === 'exhausted');
    let quotaPercentage: number | null = null;
    if (providerQuotas.length > 0) {
      // Highest usage percentage across all windows
      let maxPct = 0;
      for (const q of providerQuotas) {
        if (q.max_credits > 0) {
          const pct = q.used_credits / q.max_credits;
          if (pct > maxPct) maxPct = pct;
        }
      }
      quotaPercentage = Math.round(maxPct * 100);
    }

    // Last success/error across all credentials
    let lastSuccess: string | null = null;
    let lastError: string | null = null;
    for (const c of providerCreds) {
      if (c.last_success_at && (!lastSuccess || c.last_success_at > lastSuccess)) {
        lastSuccess = c.last_success_at;
      }
      if (c.last_error_at && (!lastError || c.last_error_at > lastError)) {
        lastError = c.last_error_at;
      }
    }

    // Determine health status
    const { status, reason } = assessHealth({
      totalCreds,
      activeCreds,
      errorCreds,
      exhaustedCreds,
      cooldownCreds,
      hasQuota,
      quotaExhausted,
      quotaPercentage,
      lastSuccess,
      lastError,
    });

    return {
      providerCode: provider.code,
      providerName: provider.name,
      status,
      reason,
      details: {
        totalCredentials: totalCreds,
        activeCredentials: activeCreds,
        errorCredentials: errorCreds,
        exhaustedCredentials: exhaustedCreds,
        cooldownCredentials: cooldownCreds,
        hasQuota,
        quotaExhausted,
        quotaPercentage,
        lastSuccess,
        lastError,
      },
    };
  });

  // 6. Overall system health
  const summary = {
    total: providerHealths.length,
    healthy: providerHealths.filter((p) => p.status === 'healthy').length,
    warning: providerHealths.filter((p) => p.status === 'warning').length,
    error: providerHealths.filter((p) => p.status === 'error').length,
    disabled: providerHealths.filter((p) => p.status === 'disabled').length,
  };

  let overall: HealthStatus = 'healthy';
  if (summary.error > 0) overall = 'error';
  else if (summary.warning > 0) overall = 'warning';

  return { overall, providers: providerHealths, summary };
}

// ─── Health assessment logic ────────────────────────────────

interface AssessInput {
  totalCreds: number;
  activeCreds: number;
  errorCreds: number;
  exhaustedCreds: number;
  cooldownCreds: number;
  hasQuota: boolean;
  quotaExhausted: boolean;
  quotaPercentage: number | null;
  lastSuccess: string | null;
  lastError: string | null;
}

function assessHealth(input: AssessInput): { status: HealthStatus; reason: string } {
  const {
    totalCreds,
    activeCreds,
    errorCreds,
    exhaustedCreds,
    cooldownCreds,
    hasQuota,
    quotaExhausted,
    quotaPercentage,
    lastSuccess,
    lastError,
  } = input;

  // No credentials at all → unknown (not configured)
  if (totalCreds === 0) {
    return { status: 'unknown', reason: 'No credentials configured' };
  }

  // All credentials in error/invalid state → error
  if (errorCreds === totalCreds) {
    return { status: 'error', reason: 'All credentials in error state' };
  }

  // All credentials exhausted → error
  if (exhaustedCreds === totalCreds) {
    return { status: 'error', reason: 'All credentials exhausted' };
  }

  // No active credentials (all in cooldown/exhausted/error) → error
  if (activeCreds === 0) {
    return { status: 'error', reason: 'No active credentials available' };
  }

  // Quota fully exhausted → error
  if (hasQuota && quotaExhausted) {
    return { status: 'error', reason: 'Quota exhausted' };
  }

  // Some credentials in error → warning
  if (errorCreds > 0) {
    return { status: 'warning', reason: `${errorCreds}/${totalCreds} credentials in error` };
  }

  // Quota > 80% → warning
  if (quotaPercentage !== null && quotaPercentage >= 80) {
    return { status: 'warning', reason: `Quota at ${quotaPercentage}%` };
  }

  // Some credentials in cooldown → warning (but still has active ones)
  if (cooldownCreds > 0 && activeCreds < totalCreds / 2) {
    return { status: 'warning', reason: `${cooldownCreds} credentials in cooldown` };
  }

  // Recent error (last 5 min) without success after → warning
  if (lastError && lastSuccess) {
    const errorTime = new Date(lastError).getTime();
    const successTime = new Date(lastSuccess).getTime();
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    if (errorTime > fiveMinAgo && errorTime > successTime) {
      return { status: 'warning', reason: 'Recent error without recovery' };
    }
  }

  // All good
  return { status: 'healthy', reason: `${activeCreds}/${totalCreds} credentials active` };
}

// ─── Helpers ────────────────────────────────────────────────

function emptyHealth(): SystemHealth {
  return {
    overall: 'unknown',
    providers: [],
    summary: { total: 0, healthy: 0, warning: 0, error: 0, disabled: 0 },
  };
}

function emptyDetails(): ProviderHealth['details'] {
  return {
    totalCredentials: 0,
    activeCredentials: 0,
    errorCredentials: 0,
    exhaustedCredentials: 0,
    cooldownCredentials: 0,
    hasQuota: false,
    quotaExhausted: false,
    quotaPercentage: null,
    lastSuccess: null,
    lastError: null,
  };
}