import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceSelect, workspaceInsert, workspaceUpdate, workspaceDelete } from '@/lib/workspace/client';
import { watchlistRowToDomain, watchlistInputToRow, watchlistToUpdateRow, type WatchlistItem, type WatchlistRow } from '@/lib/workspace/mappers';
import { optimisticList } from '@/lib/optimistic';

// ============================================================
// Watchlist API hooks — Workspace Proxy + Optimistic UI
// ============================================================
// DB table `watchlist` (renamed from `bookmarks` in migration
// 20260805000000_rename_bookmarks_to_watchlist.sql).
// Query key ['watchlist'].
// ============================================================

async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const rows = await workspaceSelect<WatchlistRow>('watchlist', {
    order: { column: 'updated_at', ascending: false },
  });
  return rows.map(watchlistRowToDomain);
}

export function useWatchlist() {
  return useQuery({ queryKey: ['watchlist'], queryFn: fetchWatchlist });
}

export function useCreateWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<WatchlistItem, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = watchlistInputToRow(input, '');
      const { user_id: _, ...rowWithoutUserId } = row;
      const created = await workspaceInsert<WatchlistRow>('watchlist', rowWithoutUserId);
      return watchlistRowToDomain(created);
    },
    ...optimisticList<WatchlistItem[], Omit<WatchlistItem, 'id' | 'createdAt' | 'updatedAt'>>(
      qc,
      ['watchlist'],
      (old, input) => [
        { ...input, id: 'temp_' + Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ...old,
      ],
    ),
  });
}

export function useUpdateWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: WatchlistItem) => {
      const updateRow = watchlistToUpdateRow(item);
      const { id, ...fields } = updateRow;
      const updated = await workspaceUpdate<WatchlistRow>('watchlist', id, fields);
      return watchlistRowToDomain(updated);
    },
    ...optimisticList<WatchlistItem[], WatchlistItem>(qc, ['watchlist'], (old, item) =>
      old.map((b) => (b.id === item.id ? { ...item, updatedAt: new Date().toISOString() } : b)),
    ),
  });
}

export function useDeleteWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await workspaceDelete('watchlist', id);
    },
    ...optimisticList<WatchlistItem[], string>(qc, ['watchlist'], (old, id) =>
      old.filter((b) => b.id !== id),
    ),
  });
}
