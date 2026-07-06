// ============================================================
// RAG Sessions — CRUD hooks cho MockAPI /RagSession
// ============================================================
//
// TanStack Query hooks. Optimistic update cho update mutation
// (rollback nếu API fail).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import { API } from '@/lib/config';
import {
  parseRawSession,
  serializeSession,
  sortSessions,
  type RagSession,
  type RagSessionRaw,
  type RagSessionWriteBody,
} from '@/lib/rag/sessions';

const QUERY_KEY = ['rag_sessions'] as const;

// ------------------------------------------------------------
// Query — list sessions
// ------------------------------------------------------------

async function fetchRagSessions(): Promise<RagSession[]> {
  const raw = await fetchJson<RagSessionRaw[]>(API.RAG_SESSIONS);
  const parsed = Array.isArray(raw) ? raw.map(parseRawSession) : [];
  return sortSessions(parsed);
}

export function useRagSessions() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchRagSessions,
    staleTime: 30_000,
  });
}

// ------------------------------------------------------------
// Create
// ------------------------------------------------------------

export function useCreateRagSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<RagSession, 'id' | 'createdAt'>): Promise<RagSession> => {
      const body: RagSessionWriteBody = serializeSession(payload);
      const raw = await fetchJson<RagSessionRaw>(API.RAG_SESSIONS, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return parseRawSession(raw);
    },
    onSuccess: (created) => {
      qc.setQueryData<RagSession[]>(QUERY_KEY, (old) => {
        if (!old) return [created];
        return sortSessions([created, ...old]);
      });
    },
  });
}

// ------------------------------------------------------------
// Update (optimistic)
// ------------------------------------------------------------

export interface UpdateRagSessionInput {
  id: string;
  patch: Partial<Omit<RagSession, 'id' | 'createdAt'>>;
}

export function useUpdateRagSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateRagSessionInput): Promise<RagSession> => {
      // Merge patch với snapshot hiện tại (nếu có) để không mất field
      const current = qc
        .getQueryData<RagSession[]>(QUERY_KEY)
        ?.find((s) => s.id === id);
      const merged = current ? { ...current, ...patch } : ({ ...patch } as RagSession);

      const body: RagSessionWriteBody = serializeSession({
        title: merged.title ?? '',
        messages: merged.messages ?? [],
        chatMode: merged.chatMode ?? 'auto',
        bookId: merged.bookId ?? '',
        bookTitle: merged.bookTitle ?? '',
        updatedAt: merged.updatedAt ?? new Date().toISOString(),
        messageCount: merged.messageCount ?? 0,
        pinned: merged.pinned ?? false,
        summary: merged.summary ?? null,
      });

      const raw = await fetchJson<RagSessionRaw>(`${API.RAG_SESSIONS}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return parseRawSession(raw);
    },
    // Optimistic update: apply patch vào cache ngay
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<RagSession[]>(QUERY_KEY);
      qc.setQueryData<RagSession[]>(QUERY_KEY, (old) => {
        if (!old) return old;
        const next = old.map((s) => (s.id === id ? { ...s, ...patch } : s));
        return sortSessions(next);
      });
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      // Rollback nếu fail
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
    },
    onSuccess: (updated) => {
      qc.setQueryData<RagSession[]>(QUERY_KEY, (old) => {
        if (!old) return [updated];
        const idx = old.findIndex((s) => s.id === updated.id);
        if (idx === -1) return sortSessions([updated, ...old]);
        const next = [...old];
        next[idx] = updated;
        return sortSessions(next);
      });
    },
  });
}

// ------------------------------------------------------------
// Delete (single + batch)
// ------------------------------------------------------------

export function useDeleteRagSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await fetchJson(`${API.RAG_SESSIONS}/${id}`, { method: 'DELETE' });
    },
    onSuccess: (_res, id) => {
      qc.setQueryData<RagSession[]>(QUERY_KEY, (old) => {
        if (!old) return old;
        return old.filter((s) => s.id !== id);
      });
    },
  });
}

export function useDeleteRagSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<void> => {
      // Parallel delete — MockAPI throughput đủ chịu.
      await Promise.all(
        ids.map((id) =>
          fetchJson(`${API.RAG_SESSIONS}/${id}`, { method: 'DELETE' }).catch(() => {
            // Bỏ qua lỗi từng cái để không block cả batch
          }),
        ),
      );
    },
    onSuccess: (_res, ids) => {
      const idSet = new Set(ids);
      qc.setQueryData<RagSession[]>(QUERY_KEY, (old) => {
        if (!old) return old;
        return old.filter((s) => !idSet.has(s.id));
      });
    },
  });
}

// ------------------------------------------------------------
// Query key export cho manual invalidate
// ------------------------------------------------------------

export const RAG_SESSIONS_QUERY_KEY = QUERY_KEY;