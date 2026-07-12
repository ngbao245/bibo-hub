// ============================================================
// Agency Studio — Email Logs API (TanStack Query)
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';

export interface EmailLog {
  id: string;
  user_id: string;
  campaign_id: string | null;
  lead_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_snapshot: string;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  status: string;
  error_message: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  unsubscribed_at: string | null;
  unsubscribe_token: string;
  sent_at: string | null;
  created_at: string;
}

export interface EmailLogFilters {
  campaignId?: string;
  status?: string;
  leadId?: string;
}

export const emailLogKeys = {
  all: ['email_logs'] as const,
  list: (filters: EmailLogFilters) => ['email_logs', 'list', filters] as const,
  detail: (id: string) => ['email_logs', 'detail', id] as const,
};

export function useEmailLogsQuery(filters: EmailLogFilters = {}) {
  return useQuery({
    queryKey: emailLogKeys.list(filters),
    queryFn: async () => {
      let q = authClient
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters.campaignId) q = q.eq('campaign_id', filters.campaignId);
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.leadId) q = q.eq('lead_id', filters.leadId);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { logs: (data ?? []) as EmailLog[] };
    },
    staleTime: 30_000,
  });
}

export function useEmailLogQuery(id: string) {
  return useQuery({
    queryKey: emailLogKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await authClient
        .from('email_logs')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return data as EmailLog;
    },
    enabled: Boolean(id),
  });
}