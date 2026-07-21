import { useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { Bookmark, BookmarkCategory, BookmarkStatus } from '@/lib/workspace/mappers';

// ============================================================
// BookmarkDialog — form thêm/sửa bookmark
// ============================================================

interface BookmarkDialogProps {
  open: boolean;
  bookmark: Bookmark | null; // null = tạo mới
  onClose: () => void;
  onSubmit: (bookmark: Bookmark | Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>) => void;
  isSubmitting?: boolean;
}

const EMPTY_BOOKMARK: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  category: 'movie',
  status: 'plan',
  rating: null,
  note: '',
  url: '',
  imageUrl: null,
  year: null,
};

const CATEGORIES: { value: BookmarkCategory; label: string }[] = [
  { value: 'movie', label: 'Phim lẻ' },
  { value: 'series', label: 'Phim bộ' },
  { value: 'manga', label: 'Manga' },
  { value: 'anime', label: 'Anime' },
  { value: 'other', label: 'Khác' },
];

const STATUSES: { value: BookmarkStatus; label: string }[] = [
  { value: 'plan', label: 'Sẽ xem' },
  { value: 'watching', label: 'Đang xem' },
  { value: 'completed', label: 'Đã xem' },
  { value: 'dropped', label: 'Dropped' },
];

export default function BookmarkDialog({
  open,
  bookmark,
  onClose,
  onSubmit,
  isSubmitting,
}: BookmarkDialogProps) {
  const [draft, setDraft] = useState<Bookmark | Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>>(
    bookmark ?? EMPTY_BOOKMARK,
  );

  useEffect(() => {
    setDraft(bookmark ?? EMPTY_BOOKMARK);
  }, [bookmark, open]);

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!draft.title.trim()) return;
    onSubmit(draft);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{bookmark ? 'Sửa bookmark' : 'Thêm bookmark'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Tên *">
            <Input
              value={draft.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="VD: Inception"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={draft.category}
                onChange={(e) => update('category', e.target.value as BookmarkCategory)}
                className="h-9 w-full border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select
                value={draft.status}
                onChange={(e) => update('status', e.target.value as BookmarkStatus)}
                className="h-9 w-full border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Năm">
              <Input
                type="number"
                value={draft.year ?? ''}
                onChange={(e) => update('year', e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="2024"
              />
            </Field>
            <Field label="Rating (0-10)">
              <Input
                type="number"
                min={0}
                max={10}
                value={draft.rating ?? ''}
                onChange={(e) => update('rating', e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Link">
            <Input
              value={draft.url}
              onChange={(e) => update('url', e.target.value)}
              placeholder="https://..."
            />
          </Field>

          <Field label="Ghi chú">
            <textarea
              value={draft.note}
              onChange={(e) => update('note', e.target.value)}
              placeholder="Cảm nhận, đánh giá..."
              className="min-h-[80px] w-full resize-y border border-input bg-background p-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !draft.title.trim()}
          >
            {isSubmitting ? 'Đang lưu...' : bookmark ? 'Cập nhật' : 'Thêm'}
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