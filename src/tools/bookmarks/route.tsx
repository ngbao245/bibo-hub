import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark as BookmarkIcon,
  Check,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Settings,
  X,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import BookmarkFavicon from './components/BookmarkFavicon';
import BookmarksSkeleton from './components/BookmarksSkeleton';
import { BookmarkOverlay } from './components/BookmarkBackground';
import { BookmarkHeader } from './components/BookmarkHeader';
import { getPublicUrl } from '@/lib/basename';
import { BookmarkStatusBar } from './components/BookmarkStatusBar';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import { EmptyState, ErrorState } from '@/components/shared';
import { useAuthStore } from '@/stores/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { workspaceRpc } from '@/lib/workspace/client';

import {
  QK,
  useBookmarkCategories,
  useBookmarkProfile,
  useBookmarks,
  useCreateBookmark,
  useCreateCategory,
  useDeleteBookmark,
  useDeleteCategory,
  useEnsureBookmarkProfile,
  useReorderBookmarks,
  useReorderCategories,
  useUpdateBookmark,
  useUpdateBookmarkProfile,
  useUpdateCategory,
} from './api';
import { useBookmarksStore } from './store';
import CategoryBlock from './components/CategoryBlock';
import BookmarkEditDialog from './components/BookmarkEditDialog';
import SettingsDialog from './components/SettingsDialog';
import BookmarkPageStyle from './components/BookmarkPageStyle';
import CustomCssEditor from './components/CustomCssEditor';
import type { Bookmark, BookmarkCategory } from './types';
import { CATEGORY_NAME_MAX } from './schemas';
import { fetchBookmarkMeta } from './lib/edge-functions';

// ============================================================
// BookmarksEdit — main edit page (owner)
// ============================================================

const OPEN_ALL_CONFIRM_THRESHOLD = 10;

export default function BookmarksEdit() {
  const authProfile = useAuthStore((s) => s.profile);
  const profileQuery = useBookmarkProfile();
  const ensureProfile = useEnsureBookmarkProfile();
  const updateProfile = useUpdateBookmarkProfile();

  const categoriesQuery = useBookmarkCategories();
  const bookmarksQuery = useBookmarks();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const reorderCategories = useReorderCategories();

  const createBookmark = useCreateBookmark();
  const updateBookmark = useUpdateBookmark();
  const deleteBookmark = useDeleteBookmark();
  const reorderBookmarks = useReorderBookmarks();
  const qc = useQueryClient();

  const search = useBookmarksStore((s) => s.search);
  const setSearch = useBookmarksStore((s) => s.setSearch);
  const dialog = useBookmarksStore((s) => s.dialog);
  const openDialog = useBookmarksStore((s) => s.openDialog);
  const closeDialog = useBookmarksStore((s) => s.closeDialog);
  const editMode = useBookmarksStore((s) => s.editMode);
  const setEditMode = useBookmarksStore((s) => s.setEditMode);

  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [hoverTitleByCat, setHoverTitleByCat] = useState<Record<string, string | null>>({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  // Snapshot only fields that are DEFERRED in edit mode.
  // Bookmark content (title/url/note/favicon) is committed immediately via
  // edit dialog and should NOT be rolled back on Cancel.
  const [snapshot, setSnapshot] = useState<{
    categories: Map<string, { orderIndex: number; columnIndex: number; name: string; hiddenFromPublic: boolean }>;
    bookmarks: Map<string, { orderIndex: number; categoryId: string }>;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [cssEditorOpen, setCssEditorOpen] = useState(false);

  // Auto-create profile on first visit
  // Reset edit mode on mount — prevents stale state after route navigation.
  useEffect(() => {
    setEditMode(false);
  }, [setEditMode]);

  const enrichedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (
      profileQuery.isSuccess &&
      profileQuery.data === null &&
      authProfile &&
      !ensureProfile.isPending
    ) {
      ensureProfile.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQuery.isSuccess, profileQuery.data, authProfile?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearch('');
        searchRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearch]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  // Track active drag for DragOverlay preview
  const [activeDrag, setActiveDrag] = useState<
    | { type: 'category'; category: BookmarkCategory }
    | { type: 'bookmark'; bookmark: Bookmark }
    | null
  >(null);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { type?: string } | undefined;
    if (data?.type === 'category-drag') {
      const cat = categories.find((c) => `cat:${c.id}` === event.active.id);
      if (cat) setActiveDrag({ type: 'category', category: cat });
    } else if (data?.type === 'bookmark') {
      const bm = bookmarks.find((b) => b.id === event.active.id);
      if (bm) setActiveDrag({ type: 'bookmark', bookmark: bm });
    }
  }

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const bookmarks = useMemo(() => bookmarksQuery.data ?? [], [bookmarksQuery.data]);

  // Retry favicon enrichment for bookmarks where the initial fetch was aborted
  // (e.g. user refreshed page while add-bookmark was still enriching in background).
  // Tracks per-session so we don't loop for permanently-failed URLs.
  useEffect(() => {
    const targets = bookmarks.filter(
      (b) =>
        b.iconType === 'image' &&
        !b.faviconUrl &&
        !b.id.startsWith('temp_') &&
        !enrichedRef.current.has(b.id),
    );
    if (targets.length === 0) return;
    for (const b of targets) {
      enrichedRef.current.add(b.id);
      fetchBookmarkMeta(b.url)
        .then((meta) => {
          if (meta.faviconUrl) {
            updateBookmark.mutate({
              id: b.id,
              faviconUrl: meta.faviconUrl,
              ...(!b.title && meta.title ? { title: meta.title } : {}),
            });
          }
        })
        .catch(() => {
          // ignore — will retry next session
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarks]);

  const bookmarksByCategory = useMemo(() => {
    const map = new Map<string, Bookmark[]>();
    for (const b of bookmarks) {
      const arr = map.get(b.categoryId) ?? [];
      arr.push(b);
      map.set(b.categoryId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.orderIndex - b.orderIndex);
    return map;
  }, [bookmarks]);

  const matchesSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return () => true;
    return (b: Bookmark) =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      b.note.toLowerCase().includes(q);
  }, [search]);

  const categoryHasMatch = useMemo(() => {
    if (!search.trim()) return () => true;
    return (cat: BookmarkCategory) => {
      const list = bookmarksByCategory.get(cat.id) ?? [];
      return list.some(matchesSearch);
    };
  }, [search, bookmarksByCategory, matchesSearch]);

  function handleQuickAdd(categoryId: string, url: string) {
    createBookmark.mutate({ categoryId, url });
  }

  function handleOpenAll(cat: BookmarkCategory) {
    const list = bookmarksByCategory.get(cat.id) ?? [];
    if (list.length === 0) return;
    if (list.length > OPEN_ALL_CONFIRM_THRESHOLD) {
      if (!window.confirm(`Mở ${list.length} tab? Trình duyệt có thể chặn popup.`)) return;
    }
    const target = profileData?.openInSameTab ? '_self' : '_blank';
    for (const b of list) window.open(b.url, target, 'noopener,noreferrer');
  }

  function handleDeleteCategory(cat: BookmarkCategory) {
    const count = bookmarksByCategory.get(cat.id)?.length ?? 0;
    const msg =
      count > 0
        ? `Xoá category "${cat.name}" và ${count} bookmark bên trong?`
        : `Xoá category "${cat.name}"?`;
    if (!window.confirm(msg)) return;
    deleteCategory.mutate(cat.id, {
      onSuccess: () => toast.success('Đã xoá category'),
      onError: (e) => toast.error('Lỗi xoá: ' + (e as Error).message),
    });
  }

  function submitNewCategory(e: FormEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    createCategory.mutate(
      { name },
      {
        onSuccess: () => toast.success('Đã tạo category'),
        onError: (e) => toast.error('Lỗi tạo: ' + (e as Error).message),
      },
    );
    setNewCategoryName('');
  }

  // ============================================================
  // Edit mode: deferred cache-only mutations for reorder/rename/toggle
  // ============================================================

  function applyCategoryPatchLocal(id: string, patch: Partial<BookmarkCategory>) {
    qc.setQueryData<BookmarkCategory[]>(QK.categories(), (old) =>
      (old ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function applyReorderCategoriesLocal(
    ordered: Array<{ id: string; orderIndex: number; columnIndex?: number }>,
  ) {
    const map = new Map(ordered.map((o) => [o.id, o]));
    qc.setQueryData<BookmarkCategory[]>(QK.categories(), (old) =>
      (old ?? [])
        .map((c) => {
          const p = map.get(c.id);
          if (!p) return c;
          return {
            ...c,
            orderIndex: p.orderIndex,
            columnIndex: p.columnIndex ?? c.columnIndex,
          };
        })
        .sort((a, b) =>
          a.columnIndex !== b.columnIndex
            ? a.columnIndex - b.columnIndex
            : a.orderIndex - b.orderIndex,
        ),
    );
  }

  function applyReorderBookmarksLocal(
    ordered: Array<{ id: string; orderIndex: number; categoryId?: string }>,
  ) {
    const map = new Map(ordered.map((o) => [o.id, o]));
    qc.setQueryData<Bookmark[]>(QK.items(), (old) =>
      (old ?? []).map((b) => {
        const p = map.get(b.id);
        if (!p) return b;
        return { ...b, orderIndex: p.orderIndex, categoryId: p.categoryId ?? b.categoryId };
      }),
    );
  }

  function handleEnterEditMode() {
    setSnapshot({
      categories: new Map(
        categories.map((c) => [
          c.id,
          {
            orderIndex: c.orderIndex,
            columnIndex: c.columnIndex,
            name: c.name,
            hiddenFromPublic: c.hiddenFromPublic,
          },
        ]),
      ),
      bookmarks: new Map(
        bookmarks.map((b) => [b.id, { orderIndex: b.orderIndex, categoryId: b.categoryId }]),
      ),
    });
    setEditMode(true);
  }

  function handleCancelEditMode() {
    if (snapshot) {
      // Restore ONLY deferred fields; preserve other content changes (title/url/etc)
      qc.setQueryData<BookmarkCategory[]>(QK.categories(), (old) =>
        (old ?? []).map((c) => {
          const snap = snapshot.categories.get(c.id);
          if (!snap) return c;
          return {
            ...c,
            orderIndex: snap.orderIndex,
            columnIndex: snap.columnIndex,
            name: snap.name,
            hiddenFromPublic: snap.hiddenFromPublic,
          };
        }),
      );
      qc.setQueryData<Bookmark[]>(QK.items(), (old) =>
        (old ?? []).map((b) => {
          const snap = snapshot.bookmarks.get(b.id);
          if (!snap) return b;
          return { ...b, orderIndex: snap.orderIndex, categoryId: snap.categoryId };
        }),
      );
    }
    setSnapshot(null);
    setEditMode(false);
  }

  async function handleSaveEditMode() {
    if (!snapshot) {
      setEditMode(false);
      return;
    }
    setSavingEdit(true);
    try {
      // Build batch items for categories
      const catItems: Array<{ id: string; patch: Record<string, unknown> }> = [];
      for (const c of categories) {
        const orig = snapshot.categories.get(c.id);
        if (!orig) continue;
        const patch: Record<string, unknown> = {};
        if (orig.name !== c.name) patch.name = c.name;
        if (orig.hiddenFromPublic !== c.hiddenFromPublic) patch.hidden_from_public = c.hiddenFromPublic;
        if (orig.orderIndex !== c.orderIndex) patch.order_index = c.orderIndex;
        if (orig.columnIndex !== c.columnIndex) patch.column_index = c.columnIndex;
        if (Object.keys(patch).length > 0) catItems.push({ id: c.id, patch });
      }

      // Build batch items for bookmarks
      const bmItems: Array<{ id: string; patch: Record<string, unknown> }> = [];
      for (const b of bookmarks) {
        const orig = snapshot.bookmarks.get(b.id);
        if (!orig) continue;
        const patch: Record<string, unknown> = {};
        if (orig.orderIndex !== b.orderIndex) patch.order_index = b.orderIndex;
        if (orig.categoryId !== b.categoryId) patch.category_id = b.categoryId;
        if (Object.keys(patch).length > 0) bmItems.push({ id: b.id, patch });
      }

      // All-or-nothing transaction per table (categories first, then bookmarks)
      if (catItems.length > 0) {
        await workspaceRpc('bookmark_batch_update', {
          p_table: 'bookmark_categories',
          p_items: catItems,
        });
      }
      if (bmItems.length > 0) {
        await workspaceRpc('bookmark_batch_update', {
          p_table: 'bookmarks',
          p_items: bmItems,
        });
      }

      const totalChanges = catItems.length + bmItems.length;
      if (totalChanges > 0) {
        toast.success(`Đã lưu ${totalChanges} thay đổi`);
      }
      setSnapshot(null);
      setEditMode(false);
    } catch (e) {
      toast.error('Lỗi lưu: ' + (e as Error).message);
      // Refetch to get actual server state after failed transaction
      qc.invalidateQueries({ queryKey: QK.categories() });
      qc.invalidateQueries({ queryKey: QK.items() });
    } finally {
      setSavingEdit(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as
      | { type?: string; categoryId?: string; columnIndex?: number }
      | undefined;
    const overData = over.data.current as
      | { type?: string; categoryId?: string; columnIndex?: number }
      | undefined;

    if (activeData?.type === 'category-drag') {
      const activeCat = categories.find((c) => `cat:${c.id}` === active.id);
      if (!activeCat) return;

      let targetColumn = activeCat.columnIndex;
      let overCat: BookmarkCategory | undefined;

      if (overData?.type === 'column-drop' && typeof overData.columnIndex === 'number') {
        targetColumn = overData.columnIndex;
      } else if (overData?.type === 'category-drag') {
        overCat = categories.find((c) => `cat:${c.id}` === over.id);
        if (overCat) targetColumn = overCat.columnIndex;
      } else {
        return;
      }

      const targetList = categories
        .filter((c) => c.columnIndex === targetColumn && c.id !== activeCat.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      let insertIdx = targetList.length;
      if (overCat) {
        insertIdx = targetList.findIndex((c) => c.id === overCat!.id);
        if (insertIdx === -1) insertIdx = targetList.length;
      }
      const nextTarget = [...targetList];
      nextTarget.splice(insertIdx, 0, { ...activeCat, columnIndex: targetColumn });

      const payload: Array<{ id: string; orderIndex: number; columnIndex?: number }> = [];
      nextTarget.forEach((c, idx) => {
        payload.push({
          id: c.id,
          orderIndex: idx,
          columnIndex: c.id === activeCat.id ? targetColumn : undefined,
        });
      });

      if (activeCat.columnIndex !== targetColumn) {
        const sourceList = categories
          .filter((c) => c.columnIndex === activeCat.columnIndex && c.id !== activeCat.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        sourceList.forEach((c, idx) => {
          payload.push({ id: c.id, orderIndex: idx });
        });
      }

      if (editMode) {
        applyReorderCategoriesLocal(payload);
      } else {
        reorderCategories.mutate(payload);
      }
      return;
    }

    if (activeData?.type === 'bookmark') {
      const activeId = active.id as string;
      const activeBookmark = bookmarks.find((b) => b.id === activeId);
      if (!activeBookmark) return;

      let targetCategoryId = activeBookmark.categoryId;
      let overBookmark: Bookmark | undefined;

      if (overData?.type === 'category' && overData.categoryId) {
        targetCategoryId = overData.categoryId;
      } else if (overData?.type === 'bookmark' && overData.categoryId) {
        overBookmark = bookmarks.find((b) => b.id === over.id);
        targetCategoryId = overData.categoryId;
      }

      const currentTarget = (bookmarksByCategory.get(targetCategoryId) ?? []).filter(
        (b) => b.id !== activeId,
      );
      let insertIdx = currentTarget.length;
      if (overBookmark) {
        insertIdx = currentTarget.findIndex((b) => b.id === overBookmark!.id);
        if (insertIdx === -1) insertIdx = currentTarget.length;
      }
      const nextTarget = [...currentTarget];
      nextTarget.splice(insertIdx, 0, { ...activeBookmark, categoryId: targetCategoryId });
      const payload = nextTarget.map((b, idx) => ({
        id: b.id,
        orderIndex: idx,
        categoryId: b.id === activeId ? targetCategoryId : undefined,
      }));
      if (editMode) {
        applyReorderBookmarksLocal(payload);
      } else {
        reorderBookmarks.mutate(payload);
      }
    }
  }

  async function handleImport(items: { url: string; title: string; category: string }[]) {
    if (items.length > 500) {
      toast.error('Tối đa 500 bookmark mỗi lần import');
      return;
    }

    // Build unique category list with temp IDs
    const catNameSet = new Map<string, string>(); // lowercase name -> temp_id
    let tempIdCounter = 0;
    const p_categories: Array<{ name: string; temp_id: string }> = [];

    for (const it of items) {
      const cleanName = it.category.trim().slice(0, CATEGORY_NAME_MAX) || 'Imported';
      const key = cleanName.toLowerCase();
      if (!catNameSet.has(key)) {
        const tid = `t_${tempIdCounter++}`;
        catNameSet.set(key, tid);
        p_categories.push({ name: cleanName, temp_id: tid });
      }
    }

    // Build bookmark list referencing temp category IDs
    const p_bookmarks = items.map((it) => {
      const cleanName = (it.category.trim().slice(0, CATEGORY_NAME_MAX) || 'Imported').toLowerCase();
      return {
        temp_category_id: catNameSet.get(cleanName)!,
        url: it.url,
        title: it.title,
      };
    });

    try {
      await workspaceRpc('bookmark_bulk_import', { p_categories, p_bookmarks });
      toast.success(`Import ${items.length} bookmark thành công`);
      // Refetch all data after successful import
      qc.invalidateQueries({ queryKey: QK.categories() });
      qc.invalidateQueries({ queryKey: QK.items() });
    } catch (e) {
      toast.error('Import thất bại (không có bookmark nào được tạo): ' + (e as Error).message);
    }
  }

  const profileData = profileQuery.data;
  const publicUrl = profileData ? getPublicUrl(`/bookmarks/${profileData.slug}`) : '';

  if (profileQuery.isLoading || categoriesQuery.isLoading || bookmarksQuery.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <Skeleton className="h-5 w-28 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>
        {/* Status bar placeholder */}
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-1.5">
          <Skeleton className="h-4 w-14 rounded-full" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <BookmarksSkeleton />
        </div>
      </div>
    );
  }

  if (profileQuery.isError || categoriesQuery.isError || bookmarksQuery.isError) {
    const err = profileQuery.error ?? categoriesQuery.error ?? bookmarksQuery.error;
    return (
      <div className="p-4">
        <ErrorState
          message={(err as Error)?.message ?? 'Lỗi tải dữ liệu'}
          onRetry={() => {
            profileQuery.refetch();
            categoriesQuery.refetch();
            bookmarksQuery.refetch();
          }}
        />
      </div>
    );
  }

  const editingId = dialog.kind === 'bookmark-edit' ? dialog.bookmarkId : null;
  const editingBookmarkResolved = editingId
    ? bookmarks.find((b) => b.id === editingId) ?? null
    : null;

  const columnCount = profileData?.columnCount ?? 3;
  const iconSize = profileData?.iconSize ?? 30;
  const pageIsPublic = profileData?.isPublic ?? false;
  const openInSameTab = profileData?.openInSameTab ?? false;

  const displayLabel =
    profileData?.displayName || authProfile?.username || profileData?.slug || 'User';

  // Mobile stacks to 1 col; from md up honor user's exact column choice.
  const gridColsClass = ['', 'grid-cols-1', 'grid-cols-1 md:grid-cols-2', 'grid-cols-1 md:grid-cols-3', 'grid-cols-1 md:grid-cols-4'][columnCount];

  return (
    <BookmarkPageStyle
      theme={profileData?.theme ?? 'system'}
      customCss={profileData?.customCss ?? ''}
      profile={profileData ?? undefined}
    >
      <div className="bibo-bookmark-page relative flex h-full flex-col overflow-hidden">
        <BookmarkOverlay
          color={profileData?.backgroundOverlayColor ?? null}
          opacity={profileData?.backgroundOverlayOpacity ?? 0}
          blend={profileData?.backgroundBlendMode ?? 'normal'}
        />
        {/* Header */}
        <header className="bibo-bookmark-header sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label="Về trang chủ"
              className="h-8 w-8"
            >
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <div className="flex flex-col leading-none">
              <h1 className="text-sm font-semibold tracking-tight text-foreground">
                Bookmarks
              </h1>
              {profileData && (
                <span className="bibo-user-info mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {displayLabel}
                  {profileData.spaceName ? ` · ${profileData.spaceName}` : ''}
                </span>
              )}
            </div>

            <div className="relative ml-auto max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                aria-label="Search bookmarks"
                className="bibo-search-input h-8 pl-8 pr-16 text-xs"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <kbd className="hidden h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
                    /
                  </kbd>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              {editMode && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                      <FolderPlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Category</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" side="bottom">
                    <form onSubmit={submitNewCategory} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Tên category
                        </label>
                        <Input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="VD: ⚙ Dev Tools"
                          className="h-8 text-xs"
                          autoFocus
                          maxLength={CATEGORY_NAME_MAX}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <PopoverClose asChild>
                          <Button variant="outline" size="sm" type="button" className="h-7 text-xs">
                            Huỷ
                          </Button>
                        </PopoverClose>
                        <PopoverClose asChild>
                          <Button size="sm" type="submit" className="h-7 gap-1 text-xs">
                            <Plus className="h-3 w-3" />
                            Tạo
                          </Button>
                        </PopoverClose>
                      </div>
                    </form>
                  </PopoverContent>
                </Popover>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openDialog({ kind: 'settings' })}
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Status bar — luôn hiện cho owner (management chrome, không gated by profile setting) */}
          {profileData && (
            <BookmarkStatusBar
              isPublic={pageIsPublic}
              slug={profileData.slug}
              publicUrl={publicUrl}
              onEnablePublic={() => openDialog({ kind: 'settings' })}
              className="border-t border-border/50 px-4 py-1.5"
            />
          )}
        </header>

        {/* Body */}
        <div className="bibo-bookmark-content relative z-10 flex-1 overflow-y-auto p-4">
          {profileData && profileData.showHero && (
            <section className="mx-auto mb-4 w-[90%] max-w-[2250px] px-8">
              <BookmarkHeader
                showHero
                displayName={displayLabel}
                spaceName={profileData.spaceName}
                publicUrl={publicUrl}
                webpage={profileData.webpage}
              />
            </section>
          )}
          {categories.length === 0 ? (
            <EmptyState
              icon={BookmarkIcon}
              title="Chưa có category nào"
              description="Tạo category đầu tiên để bắt đầu thêm bookmark."
              action={
                <p className="text-xs text-muted-foreground/70">
                  Click nút <span className="font-semibold">Category</span> ở header để tạo.
                </p>
              }
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveDrag(null)}
            >
              <div
                className={`mx-auto grid w-[90%] max-w-[2250px] gap-6 ${gridColsClass}`}
                style={{
                  gridTemplateRows: `repeat(${Math.max(
                    1,
                    ...Array.from({ length: columnCount }, (_, i) =>
                      categories.filter((c) => c.columnIndex === i).length,
                    ),
                  )}, auto)`,
                }}
              >
                {Array.from({ length: columnCount }, (_, colIdx) => {
                  const colCats = categories
                    .filter((c) => c.columnIndex === colIdx)
                    .sort((a, b) => a.orderIndex - b.orderIndex);
                  return (
                    <CategoryColumn
                      key={colIdx}
                      columnIndex={colIdx}
                      categories={colCats}
                      dropEnabled={activeDrag?.type === 'category'}
                      renderCategory={(cat) => (
                        <div
                          key={cat.id}
                          className="transition-opacity"
                          style={{ opacity: categoryHasMatch(cat) ? 1 : 0.15 }}
                        >
                          <CategoryBlock
                            category={cat}
                            bookmarks={bookmarksByCategory.get(cat.id) ?? []}
                            hoverTitle={hoverTitleByCat[cat.id] ?? null}
                            matchesSearch={matchesSearch}
                            iconSize={iconSize}
                            iconBackdrop={profileData?.iconBackdrop ?? true}
                            pageIsPublic={pageIsPublic}
                            editMode={editMode}
                            openInSameTab={openInSameTab}
                            readOnly={!editMode}
                            onEditBookmark={(b) => {
                              setEditingBookmark(b);
                              openDialog({ kind: 'bookmark-edit', bookmarkId: b.id });
                            }}
                            onHoverBookmark={(title) =>
                              setHoverTitleByCat((prev) => ({ ...prev, [cat.id]: title }))
                            }
                            onQuickAdd={handleQuickAdd}
                            onOpenAll={() => handleOpenAll(cat)}
                            onToggleHidden={() => {
                              if (editMode) {
                                applyCategoryPatchLocal(cat.id, {
                                  hiddenFromPublic: !cat.hiddenFromPublic,
                                });
                              } else {
                                updateCategory.mutate({
                                  id: cat.id,
                                  hiddenFromPublic: !cat.hiddenFromPublic,
                                });
                              }
                            }}
                            onRename={(name) => {
                              if (editMode) {
                                applyCategoryPatchLocal(cat.id, { name });
                              } else {
                                updateCategory.mutate({ id: cat.id, name });
                              }
                            }}
                            onDelete={() => handleDeleteCategory(cat)}
                          />
                        </div>
                      )}
                    />
                  );
                })}
              </div>

              {/* DragOverlay — ghost that follows cursor */}
              <DragOverlay dropAnimation={{ duration: 180 }}>
                {activeDrag?.type === 'bookmark' && (
                  <BookmarkFavicon
                    faviconUrl={activeDrag.bookmark.faviconUrl}
                    title={activeDrag.bookmark.title}
                    url={activeDrag.bookmark.url}
                    size={iconSize}
                    backdrop={profileData?.iconBackdrop ?? true}
                    iconType={activeDrag.bookmark.iconType}
                    iconText={activeDrag.bookmark.iconText}
                    iconRounded={activeDrag.bookmark.iconRounded}
                    iconBackground={activeDrag.bookmark.iconBackground}
                    className="ring-2 ring-primary shadow-lg"
                  />
                )}
                {activeDrag?.type === 'category' && (
                  <div className="rounded-xl border border-primary/40 bg-card px-3 py-2 shadow-xl">
                    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-0.5 text-[11px] font-medium text-primary">
                      {activeDrag.category.name}
                    </span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Dialogs */}
        <BookmarkEditDialog
          open={dialog.kind === 'bookmark-edit'}
          bookmark={editingBookmarkResolved ?? editingBookmark}
          categories={categories}
          onClose={closeDialog}
          onSubmit={(patch) => {
            updateBookmark.mutate(patch, {
              onSuccess: () => {
                toast.success('Đã cập nhật');
                closeDialog();
              },
              onError: (e) => toast.error('Lỗi: ' + (e as Error).message),
            });
          }}
          onDelete={(id) => {
            deleteBookmark.mutate(id, {
              onSuccess: () => {
                toast.success('Đã xoá');
                closeDialog();
              },
            });
          }}
          isSubmitting={updateBookmark.isPending || deleteBookmark.isPending}
        />

        <SettingsDialog
          open={dialog.kind === 'settings'}
          profile={profileData ?? null}
          categories={categories}
          bookmarks={bookmarks}
          onClose={closeDialog}
          onSave={(patch) =>
            updateProfile.mutate(patch, {
              onSuccess: () => {
                toast.success('Đã lưu settings');
                closeDialog();
              },
              onError: (e) => toast.error('Lỗi: ' + (e as Error).message),
            })
          }
          onImport={handleImport}
          onOpenCssEditor={() => {
            // Close settings modal but remember to reopen on CSS editor close
            closeDialog();
            setCssEditorOpen(true);
          }}
          isSubmitting={updateProfile.isPending}
        />

        {cssEditorOpen && profileData && (
          <CustomCssEditor
            profile={profileData}
            categories={categories}
            bookmarks={bookmarks}
            onClose={() => {
              setCssEditorOpen(false);
              openDialog({ kind: 'settings' });
            }}
            isSaving={updateProfile.isPending}
          />
        )}

        {/* Floating edit-mode toggle */}
        <div className="fixed bottom-4 right-4 z-20 flex items-center gap-2">
          {editMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEditMode}
                disabled={savingEdit}
                className="gap-1.5 shadow-lg"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEditMode}
                disabled={savingEdit}
                className="gap-1.5 shadow-lg"
              >
                <Check className="h-3.5 w-3.5" />
                {savingEdit ? 'Đang lưu…' : 'Save'}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleEnterEditMode}
              className="gap-1.5 shadow-lg"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>
    </BookmarkPageStyle>
  );
}

// ============================================================
// CategoryColumn — 1 of N columns
// ============================================================

interface CategoryColumnProps {
  columnIndex: number;
  categories: BookmarkCategory[];
  dropEnabled: boolean;
  renderCategory: (cat: BookmarkCategory) => React.ReactNode;
}

function CategoryColumn({
  columnIndex,
  categories,
  dropEnabled,
  renderCategory,
}: CategoryColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-drop:${columnIndex}`,
    data: { type: 'column-drop', columnIndex },
    disabled: !dropEnabled,
  });
  return (
    <SortableContext
      items={categories.map((c) => `cat:${c.id}`)}
      strategy={verticalListSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={
          'bibo-bookmark-col grid min-h-[120px] gap-6 rounded-xl border border-dashed p-2 transition-colors duration-150 [grid-template-rows:subgrid] [grid-row:1/-1] ' +
          (isOver
            ? 'border-primary/50 bg-primary/5'
            : categories.length === 0
              ? 'border-border/40'
              : 'border-transparent')
        }
      >
        {categories.map(renderCategory)}
        {categories.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
            <FolderPlus className="h-4 w-4 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground/60">Kéo category vào đây</p>
          </div>
        )}
      </div>
    </SortableContext>
  );
}

// Keep tree-shake-safe reference

