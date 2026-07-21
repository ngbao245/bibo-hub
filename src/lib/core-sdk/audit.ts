// ============================================================
// Core SDK — Audit Log
// ============================================================
// Tracks admin actions: who did what, when.
// Uses app_settings table with key 'audit_log' storing recent entries.
// (Lightweight approach — no new table needed, uses existing app_settings)
//
// For a proper audit table, create one later. This is a quick start.
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import { getCurrentUserId, getCurrentProfile } from './auth';

// ─── Types ──────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  username: string | null;
  action: string;
  details: string;
  target?: string;
}

// ─── Query ──────────────────────────────────────────────────

export const auditKeys = {
  log: ['core-sdk', 'audit-log'] as const,
};

/**
 * Fetch recent audit log entries.
 */
export function useAuditLog() {
  return useQuery({
    queryKey: auditKeys.log,
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await authClient
        .from('app_settings')
        .select('value')
        .eq('key', 'audit_log')
        .maybeSingle();

      if (error || !data) return [];
      return (data.value as AuditEntry[]) ?? [];
    },
    staleTime: 30 * 1000,
  });
}

// ─── Append entry ───────────────────────────────────────────

/**
 * Log an admin action.
 * Appends to audit_log in app_settings (keeps last 100 entries).
 */
export async function logAuditAction(action: string, details: string, target?: string): Promise<void> {
  const userId = getCurrentUserId();
  const profile = getCurrentProfile();

  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userId: userId ?? 'unknown',
    username: profile?.username ?? null,
    action,
    details,
    target,
  };

  // Load existing log
  const { data } = await authClient
    .from('app_settings')
    .select('value')
    .eq('key', 'audit_log')
    .maybeSingle();

  const existing: AuditEntry[] = (data?.value as AuditEntry[]) ?? [];
  const updated = [entry, ...existing].slice(0, 100); // Keep last 100

  // Upsert
  await authClient
    .from('app_settings')
    .upsert({ key: 'audit_log', value: updated, updated_at: new Date().toISOString() });
}

/**
 * Hook wrapper for logging audit actions.
 */
export function useLogAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { action: string; details: string; target?: string }) => {
      await logAuditAction(input.action, input.details, input.target);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: auditKeys.log });
    },
  });
}