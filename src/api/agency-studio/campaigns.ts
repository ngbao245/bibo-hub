// ============================================================
// Agency Studio — Campaigns API (TanStack Query)
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  total_leads: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export type CampaignStatus =
  | 'Draft'
  | 'Sending'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'
  | 'Scheduled';

export interface CampaignCreateInput {
  name: string;
  description?: string;
  template_id?: string;
}

export const campaignKeys = {
  all: ['campaigns'] as const,
  list: () => ['campaigns', 'list'] as const,
  detail: (id: string) => ['campaigns', 'detail', id] as const,
};

export function useCampaignsQuery() {
  return useQuery({
    queryKey: campaignKeys.list(),
    queryFn: async () => {
      const { data, error } = await authClient
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Campaign[];
    },
    staleTime: 30_000,
  });
}

/**
 * Poll campaign detail — dùng cho progress bar khi Sending.
 * `refetchInterval` = 2000ms tự động khi status = Sending, ngừng khi
 * status chuyển Completed/Failed/Cancelled.
 */
export function useCampaignDetailQuery(id: string | null) {
  return useQuery({
    queryKey: id ? campaignKeys.detail(id) : ['campaigns', 'detail', 'null'],
    queryFn: async () => {
      if (!id) throw new Error('No campaign id');
      const { data, error } = await authClient
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return data as Campaign;
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = (query.state.data as Campaign | undefined)?.status;
      return status === 'Sending' ? 2000 : false;
    },
  });
}

export function useCreateCampaignMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CampaignCreateInput) => {
      const { data, error } = await authClient
        .from('campaigns')
        .insert(input)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Campaign;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useSendCampaignMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      lead_ids: string[];
    }) => {
      const { data: { session } } = await authClient.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_AUTH_URL as string;

      // Timeout 15 phút — cover worst case 500 email × 1.2s delay = 10 phút
      // + overhead. AbortSignal.timeout throws AbortError sau timeout.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000);

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-campaign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ ...params, app_url: window.location.origin }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error((err as { error?: string }).error ?? 'Send failed');
        }

        return res.json() as Promise<{ ok: boolean; sent: number; failed: number }>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useCancelCampaignMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient
        .from('campaigns')
        .update({ status: 'Cancelled' })
        .eq('id', id)
        .in('status', ['Draft', 'Scheduled']);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}