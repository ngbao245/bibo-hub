import { create } from 'zustand';

// ============================================================
// Bookmarks UI store (Zustand) — không persist server data.
// Search query, edit dialog state, settings dialog, import/export.
// ============================================================

export type DialogKind =
  | { kind: 'none' }
  | { kind: 'bookmark-edit'; bookmarkId: string }
  | { kind: 'bookmark-new'; categoryId: string }
  | { kind: 'category-delete'; categoryId: string }
  | { kind: 'settings' };

interface BookmarksState {
  search: string;
  setSearch: (v: string) => void;
  dialog: DialogKind;
  openDialog: (d: DialogKind) => void;
  closeDialog: () => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
}

export const useBookmarksStore = create<BookmarksState>((set) => ({
  search: '',
  setSearch: (search) => set({ search }),
  dialog: { kind: 'none' },
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: { kind: 'none' } }),
  editMode: false,
  setEditMode: (editMode) => set({ editMode }),
}));
