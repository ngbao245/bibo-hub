import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Highlight, HighlightLocation } from '@/tools/library/lib/types';
import { dualWriteHighlight, dualDeleteHighlight } from '@/lib/rag/dual-write';
import { useAuthStore } from '@/stores/authStore';

// ── Workspace proxy helpers ──

const WORKSPACE_URL =
  (import.meta.env.VITE_SUPABASE_WORKSPACE_URL as string | undefined) ??
  'https://bdxgxlfjcytdnojclgor.supabase.co';

const WORKSPACE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_WORKSPACE_ANON_KEY as string | undefined) ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkeGd4bGZqY3l0ZG5vamNsZ29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MjgxMjYsImV4cCI6MjEwMDAwNDEyNn0.L1VSo8ZYH_N_33gdcMPRJLQwFH1nYzH3IWIVESWdnXg';

const PROXY_URL = `${WORKSPACE_URL}/functions/v1/workspace-proxy`;

async function proxy<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const token = useAuthStore.getState().session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: WORKSPACE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `Proxy error: ${res.status}`);
  }

  const json = (await res.json()) as { data: T };
  return json.data;
}

// ── Hooks ──

export function useHighlights(bookId: string | undefined) {
  return useQuery({
    queryKey: ['reader', 'highlights', bookId],
    enabled: !!bookId,
    queryFn: async (): Promise<Highlight[]> => {
      const rows = await proxy<Highlight[]>({
        table: 'highlights',
        action: 'select',
        filters: { book_id: bookId },
        order: { column: 'created_at', ascending: true },
      });
      return rows ?? [];
    },
  });
}

export function useCreateHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bookId: string;
      location: HighlightLocation;
      text: string;
      note?: string;
      color?: string;
    }) => {
      const row = await proxy<Highlight>({
        table: 'highlights',
        action: 'insert',
        data: {
          book_id: input.bookId,
          location: input.location,
          cfi_range: null,
          text: input.text,
          note: input.note ?? null,
          color: input.color ?? 'yellow',
        },
        single: true,
      });
      return row;
    },
    onSuccess: (h, vars) => {
      if (h?.id) dualWriteHighlight(h);
      qc.invalidateQueries({ queryKey: ['reader', 'highlights', vars.bookId] });
    },
  });
}

export function useUpdateHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; bookId: string; note?: string; color?: string }) => {
      const patch: Record<string, unknown> = {};
      if (input.note !== undefined) patch.note = input.note;
      if (input.color !== undefined) patch.color = input.color;

      const row = await proxy<Highlight>({
        table: 'highlights',
        action: 'update',
        filters: { id: input.id },
        data: patch,
        single: true,
      });
      return row;
    },
    onSuccess: (h, vars) => {
      if (h?.id) dualWriteHighlight(h);
      qc.invalidateQueries({ queryKey: ['reader', 'highlights', vars.bookId] });
    },
  });
}

export function useDeleteHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; bookId: string }) => {
      await proxy({
        table: 'highlights',
        action: 'delete',
        filters: { id: input.id },
      });
    },
    onSuccess: (_data, vars) => {
      dualDeleteHighlight(vars.id);
      qc.invalidateQueries({ queryKey: ['reader', 'highlights', vars.bookId] });
    },
  });
}