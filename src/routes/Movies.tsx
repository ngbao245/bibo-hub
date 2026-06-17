import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';

import { useMovies, useCreateMovie, useUpdateMovie, useDeleteMovie } from '@/api/movies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

import MovieCard from '@/components/movies/MovieCard';
import MovieDialog from '@/components/movies/MovieDialog';

import type { Movie, MovieStatus, MovieType } from '@/lib/movies';

// ============================================================
// Movies Page
// ============================================================
//
// Layout:
// - Header: filter status + filter type + search + add button
// - Grid: cards của phim đã filter
// - Dialog: thêm/sửa phim
// ============================================================

type StatusFilter = 'all' | MovieStatus;
type TypeFilter = 'all' | MovieType;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'watching', label: 'Đang xem' },
  { value: 'completed', label: 'Đã xem' },
  { value: 'plan', label: 'Sẽ xem' },
];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'movie', label: 'Phim lẻ' },
  { value: 'series', label: 'Phim bộ' },
];

export default function Movies() {
  const moviesQuery = useMovies();
  const createMovie = useCreateMovie();
  const updateMovie = useUpdateMovie();
  const deleteMovie = useDeleteMovie();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Movie | null>(null);

  const filtered = useMemo(() => {
    let list = moviesQuery.data ?? [];

    if (statusFilter !== 'all') {
      list = list.filter((m) => m.status === statusFilter);
    }
    if (typeFilter !== 'all') {
      list = list.filter((m) => m.type === typeFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.notes.toLowerCase().includes(q),
      );
    }
    return list;
  }, [moviesQuery.data, statusFilter, typeFilter, query]);

  function openAddDialog() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEditDialog(movie: Movie) {
    setEditing(movie);
    setDialogOpen(true);
  }

  function handleSubmit(movie: Movie | Omit<Movie, 'id'>) {
    if ('id' in movie && movie.id) {
      updateMovie.mutate(movie, {
        onSuccess: () => {
          toast.success('Đã cập nhật');
          setDialogOpen(false);
        },
        onError: () => toast.error('Lỗi cập nhật'),
      });
    } else {
      createMovie.mutate(movie, {
        onSuccess: () => {
          toast.success('Đã thêm');
          setDialogOpen(false);
        },
        onError: () => toast.error('Lỗi thêm'),
      });
    }
  }

  function handleRate(movie: Movie, rating: number) {
    updateMovie.mutate({ ...movie, rating });
  }

  async function handleDelete(movie: Movie) {
    if (!window.confirm(`Delete movie "${movie.title}"?`)) return;
    deleteMovie.mutate(movie.id, {
      onSuccess: () => toast.success('Đã xoá'),
      onError: () => toast.error('Lỗi xoá'),
    });
  }

  const isSubmitting = createMovie.isPending || updateMovie.isPending;

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
            <h1 className="text-base font-semibold text-foreground">Movies</h1>
            {moviesQuery.data && (
              <span className="font-mono text-xs text-muted-foreground">
                {filtered.length} / {moviesQuery.data.length}
              </span>
            )}
          </div>

          <Button onClick={openAddDialog} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Thêm phim
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
            {TYPE_FILTERS.map((f) => (
              <FilterButton
                key={f.value}
                active={typeFilter === f.value}
                onClick={() => setTypeFilter(f.value)}
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
              placeholder="Tìm phim..."
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
        {moviesQuery.isLoading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState query={query} onAdd={openAddDialog} />
        ) : (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((m) => (
              <MovieCard
                key={m.id}
                movie={m}
                onEdit={() => openEditDialog(m)}
                onDelete={() => handleDelete(m)}
                onRate={(r) => handleRate(m, r)}
              />
            ))}
          </div>
        )}
      </div>

      <MovieDialog
        open={dialogOpen}
        movie={editing}
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

function SkeletonGrid() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="h-48" />
      ))}
    </div>
  );
}

function EmptyState({ query, onAdd }: { query: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="mb-4 text-muted-foreground">
        {query ? `Không có phim nào khớp "${query}"` : 'Chưa có phim nào'}
      </p>
      {!query && (
        <Button onClick={onAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Thêm phim đầu tiên
        </Button>
      )}
    </div>
  );
}