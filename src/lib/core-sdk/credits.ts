// ============================================================
// Core SDK — Credit Pool System
// ============================================================
// Pre-check quota before calling external APIs.
// Flow:
//   1. checkQuota(poolCode, amount) → OK or reject with retry-after
//   2. deductCredits(poolCode, amount, metadata) → deduct + log
//   3. refundCredits(logId) → refund on failure
//
// Quota windows auto-reset when expired (now() > window_end).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import { getCurrentUserId } from './auth';

// ─── Types ──────────────────────────────────────────────────

export interface CreditPool {
  id: string;
  provider_id: string;
  code: string;
  name: string;
  credit_unit: string;
  status: 'active' | 'exhausted' | 'disabled';
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreditPoolQuota {
  id: string;
  pool_id: string;
  window_type: 'minute' | 'hour' | 'day' | 'month';
  max_credits: number;
  used_credits: number;
  window_start: string;
  window_end: string;
  status: 'available' | 'exhausted';
  created_at: string;
  updated_at: string;
}

export interface CreditUsageLog {
  id: string;
  pool_id: string;
  tool_code: string;
  user_id: string;
  credits_used: number;
  credential_id: string | null;
  request_metadata: Record<string, unknown>;
  status: 'success' | 'failed' | 'refunded';
  created_at: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  /** If not allowed, earliest window_end to retry after. */
  retryAfter?: string;
  /** Which window(s) are exhausted. */
  exhaustedWindows?: string[];
}

export interface DeductInput {
  poolCode: string;
  toolCode: string;
  amount: number;
  credentialId?: string;
  metadata?: Record<string, unknown>;
}

// ─── Query Keys ─────────────────────────────────────────────

export const creditKeys = {
  pools: ['core-sdk', 'credit-pools'] as const,
  quotas: (poolId: string) => ['core-sdk', 'credit-quotas', poolId] as const,
  usage: (filters?: Record<string, string>) => ['core-sdk', 'credit-usage', filters ?? {}] as const,
};

// ─── Queries ────────────────────────────────────────────────

/** List all credit pools. */
export function useCreditPools() {
  return useQuery({
    queryKey: creditKeys.pools,
    queryFn: async (): Promise<CreditPool[]> => {
      const { data, error } = await authClient
        .from('credit_pools')
        .select('*')
        .order('code');
      if (error) throw new Error(error.message);
      return (data ?? []) as CreditPool[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Get quotas for a specific pool. */
export function useCreditQuotas(poolId: string) {
  return useQuery({
    queryKey: creditKeys.quotas(poolId),
    queryFn: async (): Promise<CreditPoolQuota[]> => {
      const { data, error } = await authClient
        .from('credit_pool_quotas')
        .select('*')
        .eq('pool_id', poolId)
        .order('window_type');
      if (error) throw new Error(error.message);
      return (data ?? []) as CreditPoolQuota[];
    },
    enabled: !!poolId,
    staleTime: 30 * 1000, // Quotas change frequently
  });
}

/** Get usage logs with optional filters. */
export function useCreditUsage(filters?: { poolId?: string; toolCode?: string; limit?: number }) {
  return useQuery({
    queryKey: creditKeys.usage(filters as Record<string, string> | undefined),
    queryFn: async (): Promise<CreditUsageLog[]> => {
      let q = authClient
        .from('credit_usage_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.poolId) q = q.eq('pool_id', filters.poolId);
      if (filters?.toolCode) q = q.eq('tool_code', filters.toolCode);
      q = q.limit(filters?.limit ?? 100);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as CreditUsageLog[];
    },
    staleTime: 30 * 1000,
  });
}

// ─── Imperative: checkQuota ─────────────────────────────────

/**
 * Pre-check if a pool has enough quota for the requested amount.
 * Auto-resets expired windows before checking.
 *
 * @example
 * const check = await checkQuota('gemini_free', 100);
 * if (!check.allowed) {
 *   toast.error(`Quota exhausted. Retry after ${check.retryAfter}`);
 *   return;
 * }
 * // proceed with API call
 */
export async function checkQuota(poolCode: string, amount: number): Promise<QuotaCheckResult> {
  // 1. Find pool
  const { data: pool, error: poolErr } = await authClient
    .from('credit_pools')
    .select('id, status')
    .eq('code', poolCode)
    .single();

  if (poolErr || !pool) {
    return { allowed: false, exhaustedWindows: ['pool_not_found'] };
  }

  if (pool.status !== 'active') {
    return { allowed: false, exhaustedWindows: ['pool_disabled'] };
  }

  // 2. Load all quota windows for this pool
  const { data: quotas, error: quotaErr } = await authClient
    .from('credit_pool_quotas')
    .select('*')
    .eq('pool_id', pool.id);

  if (quotaErr || !quotas) {
    return { allowed: false, exhaustedWindows: ['quota_load_error'] };
  }

  const now = new Date();
  const exhausted: string[] = [];
  let earliestRetry: string | undefined;

  for (const quota of quotas as CreditPoolQuota[]) {
    const windowEnd = new Date(quota.window_end);

    // Auto-reset expired window
    if (now > windowEnd) {
      const newWindow = calculateNextWindow(quota.window_type, now);
      await authClient
        .from('credit_pool_quotas')
        .update({
          used_credits: 0,
          window_start: now.toISOString(),
          window_end: newWindow.toISOString(),
          status: 'available',
        })
        .eq('id', quota.id);
      // After reset, this window is available
      continue;
    }

    // Check if adding amount exceeds max
    if (quota.used_credits + amount > quota.max_credits) {
      exhausted.push(quota.window_type);
      if (!earliestRetry || quota.window_end < earliestRetry) {
        earliestRetry = quota.window_end;
      }
    }
  }

  if (exhausted.length > 0) {
    return { allowed: false, retryAfter: earliestRetry, exhaustedWindows: exhausted };
  }

  return { allowed: true };
}

// ─── Imperative: deductCredits ──────────────────────────────

/**
 * Deduct credits from all quota windows of a pool + log usage.
 * Call AFTER successful API call (or before if you want pre-deduct).
 *
 * @returns Usage log ID (for refund if needed).
 */
export async function deductCredits(input: DeductInput): Promise<string> {
  const { poolCode, toolCode, amount, credentialId, metadata } = input;
  const userId = getCurrentUserId();
  if (!userId) throw new Error('[core-sdk] Not authenticated');

  // 1. Find pool
  const { data: pool, error: poolErr } = await authClient
    .from('credit_pools')
    .select('id')
    .eq('code', poolCode)
    .single();

  if (poolErr || !pool) throw new Error(`[core-sdk] Pool "${poolCode}" not found`);

  // 2. Deduct from all active windows
  const { data: quotas } = await authClient
    .from('credit_pool_quotas')
    .select('id, used_credits, max_credits')
    .eq('pool_id', pool.id);

  for (const quota of (quotas ?? []) as CreditPoolQuota[]) {
    const newUsed = (quota.used_credits ?? 0) + amount;
    const newStatus = newUsed >= quota.max_credits ? 'exhausted' : 'available';

    await authClient
      .from('credit_pool_quotas')
      .update({ used_credits: newUsed, status: newStatus })
      .eq('id', quota.id);
  }

  // 3. Log usage
  const { data: log, error: logErr } = await authClient
    .from('credit_usage_logs')
    .insert({
      pool_id: pool.id,
      tool_code: toolCode,
      user_id: userId,
      credits_used: amount,
      credential_id: credentialId ?? null,
      request_metadata: metadata ?? {},
      status: 'success',
    })
    .select('id')
    .single();

  if (logErr) throw new Error(`[core-sdk] Failed to log usage: ${logErr.message}`);

  return log.id as string;
}

// ─── Imperative: refundCredits ──────────────────────────────

/**
 * Refund credits for a failed request. Reverses the deduction.
 * Marks the usage log as 'refunded'.
 */
export async function refundCredits(usageLogId: string): Promise<void> {
  // 1. Get the log entry
  const { data: log, error: logErr } = await authClient
    .from('credit_usage_logs')
    .select('pool_id, credits_used, status')
    .eq('id', usageLogId)
    .single();

  if (logErr || !log) throw new Error(`[core-sdk] Usage log "${usageLogId}" not found`);
  if ((log as CreditUsageLog).status === 'refunded') return; // Already refunded

  const { pool_id, credits_used } = log as { pool_id: string; credits_used: number };

  // 2. Add credits back to all windows
  const { data: quotas } = await authClient
    .from('credit_pool_quotas')
    .select('id, used_credits')
    .eq('pool_id', pool_id);

  for (const quota of (quotas ?? []) as CreditPoolQuota[]) {
    const newUsed = Math.max(0, (quota.used_credits ?? 0) - credits_used);
    await authClient
      .from('credit_pool_quotas')
      .update({ used_credits: newUsed, status: 'available' })
      .eq('id', quota.id);
  }

  // 3. Mark log as refunded
  await authClient
    .from('credit_usage_logs')
    .update({ status: 'refunded' })
    .eq('id', usageLogId);
}

// ─── Mutation hooks (React) ─────────────────────────────────

/** Hook wrapper for deductCredits. */
export function useDeductCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deductCredits,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'credit-quotas'] });
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'credit-usage'] });
    },
  });
}

/** Hook wrapper for refundCredits. */
export function useRefundCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refundCredits,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'credit-quotas'] });
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'credit-usage'] });
    },
  });
}

// ─── Helpers ────────────────────────────────────────────────

function calculateNextWindow(windowType: string, from: Date): Date {
  const end = new Date(from);
  switch (windowType) {
    case 'minute':
      end.setMinutes(end.getMinutes() + 1);
      break;
    case 'hour':
      end.setHours(end.getHours() + 1);
      break;
    case 'day':
      end.setDate(end.getDate() + 1);
      break;
    case 'month':
      end.setMonth(end.getMonth() + 1);
      break;
    default:
      end.setDate(end.getDate() + 1);
  }
  return end;
}