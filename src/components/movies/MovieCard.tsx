import { Star, Trash2, Edit, ExternalLink, Film, Tv } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  calculateProgress,
  type Movie,
} from '@/lib/movies';

// ============================================================
// MovieCard - card hiển thị 1 phim/series
// ============================================================

interface MovieCardProps {
  movie: Movie;
  onEdit: () => void;
  onDelete: () => void;
  onRate: (rating: number) => void;
}

const STATUS_LABELS: Record<Movie['status'], string> = {
  watching: 'Đang xem',
  completed: 'Đã xem',
  plan: 'Sẽ xem',
};

const STATUS_COLORS: Record<Movie['status'], string> = {
  watching: 'bg-primary/20 text-primary border-primary/30',
  completed: 'bg-green-500/10 text-green-500 border-green-500/30',
  plan: 'bg-muted-foreground/10 text-muted-foreground border-border',
};

export default function MovieCard({ movie, onEdit, onDelete, onRate }: MovieCardProps) {
  const progress = calculateProgress(movie);
  const Icon = movie.type === 'movie' ? Film : Tv;

  const subtitle =
    movie.type === 'movie'
      ? `${movie.currentTime} / ${movie.totalTime}`
      : `Tập ${movie.currentEpisode} / ${movie.totalEpisodes}${movie.season > 1 ? ` · S${movie.season}` : ''}`;

  return (
    <div className="border border-border bg-card transition-colors hover:border-primary">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {movie.title || 'Untitled'}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <span
          className={cn(
            'shrink-0 border px-2 py-0.5 text-[10px] uppercase tracking-wider',
            STATUS_COLORS[movie.status],
          )}
        >
          {STATUS_LABELS[movie.status]}
        </span>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-1 border-t border-border px-3 py-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onRate(movie.rating === n ? 0 : n)}
            className="text-muted-foreground transition-colors hover:text-yellow-500"
          >
            <Star
              className={cn(
                'h-3.5 w-3.5',
                n <= movie.rating && 'fill-yellow-500 text-yellow-500',
              )}
            />
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="border-t border-border px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Tiến độ</span>
          <span className="font-mono">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-1 w-full bg-background">
          <div
            className={cn(
              'h-full transition-all duration-300',
              movie.status === 'completed' ? 'bg-green-500' : 'bg-primary',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Notes preview */}
      {movie.notes && (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground line-clamp-2">
          {movie.notes}
        </div>
      )}

      {/* Actions */}
      <div className="flex border-t border-border">
        {movie.watchUrl && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 flex-1 justify-center gap-1.5 rounded-none text-xs"
          >
            <a href={movie.watchUrl} target="_blank" rel="noopener noreferrer">
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
