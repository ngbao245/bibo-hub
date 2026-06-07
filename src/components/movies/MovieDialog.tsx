import { useEffect, useState } from 'react';
import { Film, Tv, Lightbulb } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  autoStatus,
  parseTimeInput,
  type Movie,
  type MovieType,
} from '@/lib/movies';

// ============================================================
// MovieDialog - form thêm/sửa phim
// ============================================================

interface MovieDialogProps {
  open: boolean;
  movie: Movie | null; // null = tạo mới
  onClose: () => void;
  onSubmit: (movie: Movie | Omit<Movie, 'id'>) => void;
  isSubmitting?: boolean;
}

const EMPTY_MOVIE: Omit<Movie, 'id'> = {
  title: '',
  type: 'movie',
  status: 'plan',
  notes: '',
  watchUrl: '',
  rating: 0,
  currentTime: '0:00',
  totalTime: '0:00',
  season: 1,
  currentEpisode: 0,
  totalEpisodes: 0,
};

export default function MovieDialog({
  open,
  movie,
  onClose,
  onSubmit,
  isSubmitting,
}: MovieDialogProps) {
  const [draft, setDraft] = useState<Movie | Omit<Movie, 'id'>>(movie ?? EMPTY_MOVIE);

  // Reset khi mở dialog mới hoặc đổi movie đang edit
  useEffect(() => {
    setDraft(movie ?? EMPTY_MOVIE);
  }, [movie, open]);

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!draft.title.trim()) return;

    // Normalize time inputs
    const normalized: typeof draft = {
      ...draft,
      currentTime: parseTimeInput(draft.currentTime),
      totalTime: parseTimeInput(draft.totalTime),
    };

    // Auto-update status từ progress
    const finalDraft: typeof draft = {
      ...normalized,
      status: autoStatus(normalized as Movie),
    };

    onSubmit(finalDraft);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{movie ? 'Sửa phim' : 'Thêm phim'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Type tabs */}
          <Tabs
            value={draft.type}
            onValueChange={(v) => update('type', v as MovieType)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="movie" className="gap-1.5">
                <Film className="h-3.5 w-3.5" />
                Phim lẻ
              </TabsTrigger>
              <TabsTrigger value="series" className="gap-1.5">
                <Tv className="h-3.5 w-3.5" />
                Phim bộ
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Field label="Tên phim *">
            <Input
              value={draft.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="VD: Inception"
              autoFocus
            />
          </Field>

          {draft.type === 'movie' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Đã xem">
                <Input
                  value={draft.currentTime}
                  onChange={(e) => update('currentTime', e.target.value)}
                  placeholder="0:00"
                  className="font-mono"
                />
              </Field>
              <Field label="Tổng">
                <Input
                  value={draft.totalTime}
                  onChange={(e) => update('totalTime', e.target.value)}
                  placeholder="120:00"
                  className="font-mono"
                />
              </Field>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Season">
                  <Input
                    type="number"
                    min={1}
                    value={draft.season}
                    onChange={(e) => update('season', parseInt(e.target.value, 10) || 1)}
                  />
                </Field>
                <Field label="Tập đã xem">
                  <Input
                    type="number"
                    min={0}
                    value={draft.currentEpisode}
                    onChange={(e) =>
                      update('currentEpisode', parseInt(e.target.value, 10) || 0)
                    }
                  />
                </Field>
                <Field label="Tổng tập">
                  <Input
                    type="number"
                    min={0}
                    value={draft.totalEpisodes}
                    onChange={(e) =>
                      update('totalEpisodes', parseInt(e.target.value, 10) || 0)
                    }
                  />
                </Field>
              </div>
            </>
          )}

          <Field label="Link xem">
            <Input
              value={draft.watchUrl}
              onChange={(e) => update('watchUrl', e.target.value)}
              placeholder="https://..."
            />
          </Field>

          <Field label="Ghi chú">
            <textarea
              value={draft.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Cảm nhận, đánh giá..."
              className="min-h-[80px] w-full resize-y border border-input bg-background p-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          <p className="inline-flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Status tự động: có tiến độ → "Đang xem", đã xong → "Đã xem"
            </span>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !draft.title.trim()}
          >
            {isSubmitting ? 'Đang lưu...' : movie ? 'Cập nhật' : 'Thêm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
