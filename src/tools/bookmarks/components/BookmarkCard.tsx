import { Star, Trash2, Edit, ExternalLink, Film, Tv, BookOpen, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { Bookmark, BookmarkCategory } from '@/lib/workspace/mappers';

// ============================================================
// BookmarkCard — card hiển thị 1 bookmark (movie/series/manga/anime/other)
// ============================================================

interface BookmarkCardProps {
  bookmark: Bookmark;
  onEdit: () => void;
  onDelete: () => void;
  onRate: (rating: number) => void;
}

const STATUS_LABELS: Record<Bookmark['status'], string> = {
  watching: 'Đang xem',
  completed: 'Đã xem',
  plan: 'Sẽ xem',
  dropped: 'Dropped',
};

const STATUS_COLORS: Record<Bookmark['status'], string> = {
  watching: 'bg-primary/20 text-primary border-primary/30',
  completed: 'bg-success/10 text-success border-success/30',
  plan: 'bg-muted-foreground/10 text-muted-foreground border-border',
  dropped: 'bg-destructive/10 text-destructive border-destructive/30',
};

const CATEGORY_ICONS: Record<BookmarkCategory, React.ElementType> = {
  movie: Film,
  series: Tv,
  manga: BookOpen,
  anime: Play,
  other: Film,
};

export default function BookmarkCard({ bookmark, onEdit, onDelete, onRate }: BookmarkCardProps) {
  const Icon = CATEGORY_ICONS[bookmark.category] ?? Film;

  return (
    <div className="border border-border bg-card transition-colors hover:border-primary">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {bookmark.title || 'Untitled'}
            </h3>
            {bookmark.year && (
              <p className="mt-0.5 text-xs text-muted-foreground">{bookmark.year}</p>
            )}
          </div>
        </div>

        <span
          className={cn(
            'shrink-0 border px-2 py-0.5 text-[10px] uppercase tracking-wider',
            STATUS_COLORS[bookmark.status],
          )}
        >
          {STATUS_LABELS[bookmark.status]}
        </span>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-1 border-t border-border px-3 py-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            onClick={() => onRate(bookmark.rating === n ? 0 : n)}
            className="text-muted-foreground transition-colors hover:text-yellow-500"
          >
            <Star
              className={cn(
                'h-3 w-3',
                bookmark.rating !== null && n <= bookmark.rating && 'fill-yellow-500 text-yellow-500',
              )}
            />
          </button>
        ))}
      </div>

      {/* Notes preview */}
      {bookmark.note && (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground line-clamp-2">
          {bookmark.note}
        </div>
      )}

      {/* Actions */}
      <div className="flex border-t border-border">
        {bookmark.url && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 flex-1 justify-center gap-1.5 rounded-none text-xs"
          >
            <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Xem
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 flex-1 justify-center gap-1.5 rounded-none text-xs"
        >
          <Edit className="h-3 w-3" />
          Sửa
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 flex-1 justify-center gap-1.5 rounded-none text-xs text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3 w-3" />
          Xoá
        </Button>
      </div>
    </div>
  );
}