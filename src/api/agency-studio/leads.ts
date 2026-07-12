// ============================================================
// Agency Studio — Leads API (TanStack Query)
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';
import type { LeadFilters } from '@/stores/agencyStudioStore';

export interface Lead {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  company: string | null;
  phone: string | null;
  website: string | null;
  status: 'New' | 'Contacted' | 'Interested' | 'Won' | 'Lost';
  tags: string[];
  notes: string | null;
  unsubscribed: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Escape PostgREST `.or()` filter — quote comma/parenthesis/dot trong
 * search string để không break syntax. VD user gõ "a,b" sẽ được escape
 * thành "a%2Cb". Chỉ áp dụng cho phần value, không đụng operator.
 */
function escapeOrValue(v: string): string {
  return v.replace(/([,()])/g, '\\$1');
}

export type LeadStatus = Lead['status'];
export const LEAD_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Interested', 'Won', 'Lost'];

export interface LeadCreateInput {
  full_name: string;
  email: string;
  company?: string;
  phone?: string;
  website?: string;
  status?: LeadStatus;
  tags?: string[];
  notes?: string;
}

export interface LeadUpdateInput extends Partial<LeadCreateInput> {
  id: string;
}

const PAGE_SIZE = 20;

// ============================================================
// Query keys
// ============================================================
export const leadKeys = {
  all: ['leads'] as const,
  list: (filters: LeadFilters, page: number) => ['leads', 'list', filters, page] as const,
  detail: (id: string) => ['leads', 'detail', id] as const,
};

// ============================================================
// Hooks
// ============================================================

function applyLeadFilters<T extends { or: (v: string) => T; eq: (a: string, b: string) => T; overlaps: (a: string, b: string[]) => T; is: (a: string, b: null) => T }>(
  q: T,
  filters: LeadFilters,
): T {
  q = q.is('deleted_at', null);
  if (filters.search) {
    const s = escapeOrValue(filters.search);
    q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,company.ilike.%${s}%`);
  }
  if (filters.status) {
    q = q.eq('status', filters.status);
  }
  if (filters.tags.length > 0) {
    q = q.overlaps('tags', filters.tags);
  }
  return q;
}

export function useLeadsQuery(filters: LeadFilters, page = 0) {
  return useQuery({
    queryKey: leadKeys.list(filters, page),
    queryFn: async () => {
      let q = authClient
        .from('leads')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      q = applyLeadFilters(q as any, filters);

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return { leads: (data ?? []) as Lead[], total: count ?? 0, page, pageSize: PAGE_SIZE };
    },
    staleTime: 30_000,
  });
}

/**
 * Load ALL leads matching filter (không dùng pagination) — dùng cho export CSV.
 * Có giới hạn 5000 cứng để tránh OOM nếu user có quá nhiều lead.
 */
export function useAllLeadsMatchingFilter(filters: LeadFilters, enabled = false) {
  return useQuery({
    queryKey: [...leadKeys.all, 'export', filters],
    queryFn: async () => {
      let q = authClient
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      q = applyLeadFilters(q as any, filters);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Lead[];
    },
    enabled,
    staleTime: 0,
    gcTime: 30_000,
  });
}

export function useLeadQuery(id: string) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await authClient
        .from('leads')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      if (error) throw new Error(error.message);
      return data as Lead;
    },
    enabled: Boolean(id),
  });
}

export function useCreateLeadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadCreateInput) => {
      const { data, error } = await authClient
        .from('leads')
        .insert(input)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Lead;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useUpdateLeadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: LeadUpdateInput) => {
      const { data, error } = await authClient
        .from('leads')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Lead;
    },
    // Optimistic update: update cache detail + list ngay, rollback nếu fail.
    onMutate: async ({ id, ...input }) => {
      await qc.cancelQueries({ queryKey: leadKeys.detail(id) });
      const previousDetail = qc.getQueryData<Lead>(leadKeys.detail(id));
      if (previousDetail) {
        qc.setQueryData<Lead>(leadKeys.detail(id), {
          ...previousDetail,
          ...input,
          updated_at: new Date().toISOString(),
        });
      }
      return { previousDetail };
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.previousDetail) {
        qc.setQueryData(leadKeys.detail(id), ctx.previousDetail);
      }
    },
    onSettled: (data) => {
      if (data) qc.setQueryData(leadKeys.detail(data.id), data);
      void qc.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useDeleteLeadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: mark deleted_at thay vì hard delete → cho phép undo.
      const { error } = await authClient
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useBulkDeleteLeadsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      // Soft delete batch. Trả về IDs + timestamp để restore mutation có
      // thể revert đúng records (dùng cho undo toast).
      const deletedAt = new Date().toISOString();
      const { error } = await authClient
        .from('leads')
        .update({ deleted_at: deletedAt })
        .in('id', ids);
      if (error) throw new Error(error.message);
      return { ids, deletedAt };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

/**
 * Restore leads đã soft-delete — clear `deleted_at`. Dùng cho undo toast.
 */
export function useRestoreLeadsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await authClient
        .from('leads')
        .update({ deleted_at: null })
        .in('id', ids);
      if (error) throw new Error(error.message);
      return ids;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useBulkUpdateStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: LeadStatus }) => {
      const { error } = await authClient
        .from('leads')
        .update({ status })
        .in('id', ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

/**
 * Apply tag cho nhiều lead — merge với tags hiện có (không overwrite).
 */
export function useBulkAddTagMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, tag }: { ids: string[]; tag: string }) => {
      // Cần fetch tags hiện có để merge — không có SQL array_append từ
      // PostgREST đơn giản, làm client-side: fetch → merge → update per row.
      // Chấp nhận N+1 vì bulk operation không thường xuyên + số lượng nhỏ.
      const { data: leads, error: fetchErr } = await authClient
        .from('leads')
        .select('id, tags')
        .in('id', ids);
      if (fetchErr) throw new Error(fetchErr.message);

      const updates = (leads ?? []).map(async (l) => {
        const tags = Array.isArray(l.tags) ? l.tags : [];
        if (tags.includes(tag)) return; // idempotent
        const newTags = [...tags, tag];
        const { error: updErr } = await authClient
          .from('leads')
          .update({ tags: newTags })
          .eq('id', l.id);
        if (updErr) throw new Error(updErr.message);
      });
      await Promise.all(updates);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

/**
 * Bulk import leads — insert 1 call. Trả về `inserted` + `duplicates`
 * để UI hiển thị summary chuẩn xác.
 */
export function useBulkImportLeadsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: LeadCreateInput[]) => {
      if (rows.length === 0) return { inserted: 0, duplicates: [] as string[] };

      // Detect email đã tồn tại (active leads).
      const emails = rows.map((r) => r.email);
      const { data: existing, error: dupErr } = await authClient
        .from('leads')
        .select('email')
        .in('email', emails)
        .is('deleted_at', null);
      if (dupErr) throw new Error(dupErr.message);

      const existingEmails = new Set((existing ?? []).map((r) => r.email as string));
      const uniqueRows = rows.filter((r) => !existingEmails.has(r.email));

      if (uniqueRows.length === 0) {
        return { inserted: 0, duplicates: [...existingEmails] };
      }

      const { error: insErr } = await authClient.from('leads').insert(uniqueRows);
      if (insErr) throw new Error(insErr.message);

      return { inserted: uniqueRows.length, duplicates: [...existingEmails] };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}