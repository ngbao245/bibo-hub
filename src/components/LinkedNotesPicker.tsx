import { useEffect, useMemo, useState } from 'react';
import { Search, X, Check } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

import type { Note } from '@/schemas/note';

// ============================================================
// LinkedNotesPicker - Modal chọn nhiều note để link
// ============================================================
//
// Search theo title/content/type. Toggle chọn từng note.
// Bấm Save → callback `onSave(selectedIds)` với list ids đã chọn.
// ============================================================

interface LinkedNotesPickerProps {
  /** Modal có đang mở không */
  open: boolean;
  /** Toàn bộ notes trong DB */
  allNotes: Note[];
  /** ID note hiện tại (loại khỏi danh sách chọn) */
  currentNoteId: string | null;
  /** Các id đã link sẵn (highlight checked khi mở) */
  initialSelected: string[];
  /** Đóng modal */
  onClose: () => void;
  /** User bấm Save → trả về list ids cuối cùng */
  onSave: (ids: string[]) => void;
}

export default function LinkedNotesPicker({
  open,
  allNotes,
  currentNoteId,
  initialSelected,
  onClose,
  onSave,
}: LinkedNotesPickerProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));

  // Reset state mỗi khi mở modal
  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelected));
      setQuery('');
    }
  }, [open, initialSelected]);

  // Notes có thể link: bỏ secret/source, bỏ chính nó, bỏ child note (link tới note gốc thôi)
  const candidates = useMemo(() => {
    return allNotes.filter(
      (n) =>
        n.id !== currentNoteId &&
        n.type !== 'secret' &&
        n.type !== 'source' &&
        !n.isChildNote,
    );
  }, [allNotes, currentNoteId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q),
    );
  }, [candidates, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    onSave(Array.from(selected));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Chọn note để link</DialogTitle>
          <DialogDescription>
            Tìm note theo title, nội dung, hoặc type. Click để chọn/bỏ chọn.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm note (title, nội dung, hoặc type: note/ielts/course/code)..."
            autoFocus
            className="h-9 pl-7 pr-7 text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto border border-border bg-card">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {query ? `Không có note nào khớp "${query}"` : 'Không có note nào để link'}
            </div>
          ) : (
            <ul>
              {filtered.map((n) => {
                const isSelected = selected.has(n.id);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => toggle(n.id)}
                      className={cn(
                        'flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left transition-colors',
                        isSelected
                          ? 'bg-popover'
                          : 'hover:bg-popover/50',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground">
                          {n.title || 'Untitled'}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <span>{n.type}</span>
                          {n.createdAt && (
                            <>
                              <span>·</span>
                              <span>
                                {new Date(n.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center border',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">
            Đã chọn {selected.size} note
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Hủy
            </Button>
            <Button size="sm" onClick={handleSave}>
              Lưu liên kết
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
