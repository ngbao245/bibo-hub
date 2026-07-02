// ============================================================
// RAG TanStack Query hooks
// ============================================================
//
// Wrapper quanh lib/rag để dùng trong components:
//   - useRagSearch(query, opts)  — debounced semantic search
//
// Phase 3 sẽ add:
//   - useRagChat  — hybrid chat với mode auto/internal
//
// Tính debounce: dùng `useDebouncedEffect` đã có (search trên proj).
// ============================================================

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ragRetrieve, type RagRetrieveOpts, type RagRetrieveResult } from '@/lib/rag/search';
import { useRagStore } from '@/stores/ragStore';

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Semantic search với debounce 300ms.
 *
 * - Empty query → disabled, không gọi API.
 * - RAG chưa ready → disabled, hiện CTA setup.
 * - 2 lần search liên tiếp <300ms → chỉ chạy lần cuối.
 */
export function useRagSearch(
  query: string,
  opts: RagRetrieveOpts & { debounceMs?: number; enabled?: boolean } = {},
) {
  const status = useRagStore((s) => s.status);
  const ready = status === 'ready';
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  // Debounce query
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  const trimmed = debounced.trim();
  const enabled = (opts.enabled ?? true) && ready && trimmed.length > 0;

  return useQuery<RagRetrieveResult>({
    queryKey: [
      'rag', 'search', trimmed,
      opts.filterTypes ?? null,
      opts.filterMetadata ?? null,
      opts.minSimilarity ?? null,
      opts.limit ?? null,
    ],
    queryFn: () =>
      ragRetrieve(trimmed, {
        limit: opts.limit,
        filterTypes: opts.filterTypes,
        filterMetadata: opts.filterMetadata,
        minSimilarity: opts.minSimilarity,
      }),
    enabled,
    // Cache 2 phút — search lại cùng query trong window này không gọi lại API
    staleTime: 2 * 60_000,
    // Không retry khi fail (vd hết quota), user thử lại tay
    retry: false,
  });
}