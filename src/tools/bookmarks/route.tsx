import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bookmark as BookmarkIcon, Plus, Search, X } from 'lucide-react';

import { useBookmarks, useCreateBookmark, useUpdateBookmark, useDeleteBookmark } from '@/tools/bookmarks/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { EmptyState, LoadingState } from '@/components/shared';
import { cn } from '@/lib/cn';

import BookmarkCard from '@/tools/bookmarks/components/BookmarkCard';
import BookmarkDialog from '@/tools/bookmarks/components/BookmarkDialog';

import type { Bookmark, BookmarkStatus, BookmarkCategory } from '@/lib/workspace/mappers';

// ============================================================
// Bookmarks Page (formerly Movies)
// ============================================================

type StatusFilter = 'all' | BookmarkStatus;
type CategoryFilter = 'all' | BookmarkCategory;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'watching', label: 'Đang xem' },
  { value: 'completed', label: 'Đã xem' },
  { value: 'plan', label: 'Sẽ xem' },
  { value: 'dropped', label: 'Dropped' },
];

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'movie', label: 'Phim lẻ' },
  { value: 'series', label: 'Phim bộ' },
  { value: 'manga', label: 'Manga' },
  { value: 'anime', label: 'Anime' },
  { value: 'other', label: 'Khác' },
];

export default function Bookmarks() {
  const bookmarksQuery = useBookmarks();
  const createBookmark = useCreateBookmark();
  const updateBookmark = useUpdateBookmark();
  const deleteBookmark = useDeleteBookmark();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Bookmark | null>(null);

  const filtered = useMemo(() => {
    let list = bookmarksQuery.data ?? [];

    if (statusFilter !== 'all') {
      list = list.filter((b) => b.status === statusFilter);
    }
    if (categoryFilter !== 'all') {
      list = list.filter((b) => b.category === categoryFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.note.toLowerCase().includes(q),
      );
    }
    return list;
  }, [bookmarksQuery.data, statusFilter, categoryFilter, query]);

  function openAddDialog() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEditDialog(bookmark: Bookmark) {
    setEditing(bookmark);
    setDialogOpen(true);
  }

  function handleSubmit(bookmark: Bookmark | Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>) {
    if ('id' in bookmark && bookmark.id) {
      updateBookmark.mutate(bookmark as Bookmark, {
        onSuccess: () => {
          toast.success('Đã cập nhật');
          setDialogOpen(false);
        },
        onError: () => toast.error('Lỗi cập nhật'),
      });
    } else {
      createBookmark.mutate(bookmark as Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>, {
        onSuccess: () => {
          toast.success('Đã thêm');
          setDialogOpen(false);
        },
        onError: () => toast.error('Lỗi thêm'),
      });
    }
  }

  function handleRate(bookmark: Bookmark, rating: number) {
    updateBookmark.mutate({ ...bookmark, rating });
  }

  async function handleDelete(bookmark: Bookmark) {
    if (!window.confirm(`Xoá "${bookmark.title}"?`)) return;
    deleteBookmark.mutate(bookmark.id, {
      onSuccess: () => toast.success('Đã xoá'),
      onError: () => toast.error('Lỗi xoá'),
    });
  }

  const isSubmitting = createBookmark.isPending || updateBookmark.isPending;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-base font-semibold text-foreground">Bookmarks</h1>
            {bookmarksQuery.data && (
              <span className="font-mono text-xs text-muted-foreground">
                {filtered.length} / {bookmarksQuery.data.length}
              </span>
            )}
          </div>

          <Button onClick={openAddDialog} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Thêm
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <FilterButton
                key={f.value}
                active={statusFilter === f.value}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </FilterButton>
            ))}
          </div>

          <span className="h-4 w-px bg-border" />

          <div className="flex flex-wrap gap-1">
            {CATEGORY_FILTERS.map((f) => (
              <FilterButton
                key={f.value}
                active={categoryFilter === f.value}
                onClick={() => setCategoryFilter(f.value)}
              >
                {f.label}
              </FilterButton>
            ))}
          </div>

          <div className="relative ml-auto">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm..."
              className="h-7 w-48 pl-7 pr-7 text-xs"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {bookmarksQuery.isLoading ? (
          <LoadingState
            variant="skeleton"
            count={8}
            itemClassName="h-48"
            className="mx-auto max-w-6xl xl:grid-cols-4"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BookmarkIcon}
            title={query ? `Không có kết quả cho "${query}"` : 'Chưa có bookmark nào'}
            description={query ? 'Thử từ khoá khác hoặc xoá bộ lọc.' : 'Thêm bookmark đầu tiên để bắt đầu.'}
            action={
              !query && (
                <Button onClick={openAddDialog} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Thêm bookmark
                </Button>
              )
            }
          />
        ) : (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((b) => (
              <BookmarkCard
                key={b.id}
                bookmark={b}
                onEdit={() => openEditDialog(b)}
                onDelete={() => handleDelete(b)}
                onRate={(r) => handleRate(b, r)}
              />
            ))}
          </div>
        )}
      </div>

      <BookmarkDialog
        open={dialogOpen}
        bookmark={editing}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

// ============================================================
function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'border px-2 py-1 text-xs transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}