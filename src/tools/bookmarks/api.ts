import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceSelect, workspaceInsert, workspaceUpdate, workspaceDelete } from '@/lib/workspace/client';
import { bookmarkRowToDomain, bookmarkInputToRow, bookmarkToUpdateRow, type Bookmark, type BookmarkRow } from '@/lib/workspace/mappers';
import { optimisticList } from '@/lib/optimistic';

// ============================================================
// Bookmarks API hooks — Workspace Proxy + Optimistic UI
// ============================================================

async function fetchBookmarks(): Promise<Bookmark[]> {
  const rows = await workspaceSelect<BookmarkRow>('bookmarks', {
    order: { column: 'updated_at', ascending: false },
  });
  return rows.map(bookmarkRowToDomain);
}

export function useBookmarks() {
  return useQuery({ queryKey: ['bookmarks'], queryFn: fetchBookmarks });
}

export function useCreateBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = bookmarkInputToRow(input, '');
      const { user_id: _, ...rowWithoutUserId } = row;
      const created = await workspaceInsert<BookmarkRow>('bookmarks', rowWithoutUserId);
      return bookmarkRowToDomain(created);
    },
    ...optimisticList<Bookmark[], Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>>(
      qc,
      ['bookmarks'],
      (old, input) => [
        { ...input, id: 'temp_' + Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ...old,
      ],
    ),
  });
}

export function useUpdateBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bookmark: Bookmark) => {
      const updateRow = bookmarkToUpdateRow(bookmark);
      const { id, ...fields } = updateRow;
      const updated = await workspaceUpdate<BookmarkRow>('bookmarks', id, fields);
      return bookmarkRowToDomain(updated);
    },
    ...optimisticList<Bookmark[], Bookmark>(qc, ['bookmarks'], (old, bookmark) =>
      old.map((b) => (b.id === bookmark.id ? { ...bookmark, updatedAt: new Date().toISOString() } : b)),
    ),
  });
}

export function useDeleteBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await workspaceDelete('bookmarks', id);
    },
    ...optimisticList<Bookmark[], string>(qc, ['bookmarks'], (old, id) =>
      old.filter((b) => b.id !== id),
    ),
  });
}