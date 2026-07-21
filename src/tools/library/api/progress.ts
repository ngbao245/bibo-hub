import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReadingProgress } from '@/tools/library/lib/types';
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

export function useProgress(bookId: string | undefined) {
  return useQuery({
    queryKey: ['reader', 'progress', bookId],
    enabled: !!bookId,
    queryFn: async (): Promise<ReadingProgress | null> => {
      const rows = await proxy<ReadingProgress[]>({
        table: 'reading_progress',
        action: 'select',
        filters: { book_id: bookId },
        limit: 1,
      });
      return rows?.length ? rows[0] : null;
    },
  });
}

/**
 * Fetch progress for ALL books → map by book_id.
 * Used by Library to show "page X / Y" on each card.
 */
export function useAllProgress() {
  return useQuery({
    queryKey: ['reader', 'progress', 'all'],
    queryFn: async (): Promise<Map<string, ReadingProgress>> => {
      const rows = await proxy<ReadingProgress[]>({
        table: 'reading_progress',
        action: 'select',
      });
      const map = new Map<string, ReadingProgress>();
      for (const row of (rows ?? [])) {
        map.set(row.book_id, row);
      }
      return map;
    },
    staleTime: 5 * 60_000,
  });
}

export function useSaveProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { bookId: string; location: string; progress: number }) => {
      await proxy({
        table: 'reading_progress',
        action: 'upsert',
        data: {
          book_id: input.bookId,
          location: input.location,
          progress: input.progress,
          updated_at: new Date().toISOString(),
        },
        onConflict: 'book_id,user_id',
        single: true,
      });
    },
    onSuccess: (_data, vars) => {
      qc.setQueryData(['reader', 'progress', vars.bookId], (old: ReadingProgress | null | undefined) => {
        const base = old ?? { id: '', user_id: '', book_id: vars.bookId };
        return {
          ...base,
          location: vars.location,
          progress: vars.progress,
          updated_at: new Date().toISOString(),
        } as ReadingProgress;
      });
      qc.setQueryData<Map<string, ReadingProgress> | undefined>(
        ['reader', 'progress', 'all'],
        (old) => {
          if (!old) return old;
          const next = new Map(old);
          const existing = next.get(vars.bookId);
          const base = existing ?? { id: '', user_id: '', book_id: vars.bookId };
          next.set(vars.bookId, {
            ...base,
            location: vars.location,
            progress: vars.progress,
            updated_at: new Date().toISOString(),
          } as ReadingProgress);
          return next;
        },
      );
    },
  });
}