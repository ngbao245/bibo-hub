import { useMemo, useState } from 'react';
import { Search, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import type { Note, NoteType } from '@/schemas/note';
import { REGULAR_NOTE_TYPES } from '@/schemas/note';

// ============================================================
// NoteList - sidebar list bên trái Notes page
// ============================================================
//
// Có: type filter, search box, button New, list các note.
// Click note → callback select. Highlight note đang được chọn.
// Child notes (isChildNote=true) bị ẩn — chỉ xem qua note cha.
// ============================================================

const NOTE_TYPES: { value: NoteType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'note', label: 'Note' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'course', label: 'Course' },
  { value: 'code', label: 'Code' },
];

const REGULAR_TYPES: NoteType[] = REGULAR_NOTE_TYPES;

interface NoteListProps {
  notes: Note[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function NoteList({
  notes,
  isLoading,
  selectedId,
  onSelect,
  onNew,
}: NoteListProps) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useLocalStorage<NoteType | 'all'>('notes_typeFilter', 'all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = notes;

    // Chỉ lấy note loại regular + KHÔNG phải child note (child note ẩn khỏi list)
    list = list.filter((n) => REGULAR_TYPES.includes(n.type) && !n.isChildNote);

    // Type filter
    if (typeFilter !== 'all') {
      list = list.filter((n) => n.type === typeFilter);
    }

    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.tags?.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      );
    }

    // Sort: updatedAt mới nhất lên trên
    return [...list].sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [notes, query, typeFilter]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2">
        <h3 className="text-sm font-medium uppercase tracking-wider text-secondary-foreground">
          Notes
        </h3>
        <Button size="icon" variant="ghost" onClick={onNew} title="Tạo note mới" className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm note..."
            className="h-8 pl-7 pr-7 text-xs"
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

      {/* Type filter */}
      <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
        {NOTE_TYPES.map((t) => {
          const count =
            t.value === 'all'
              ? notes.filter((n) => REGULAR_TYPES.includes(n.type) && !n.isChildNote).length
              : notes.filter((n) => n.type === t.value && !n.isChildNote).length;
          return (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={cn(
                'px-1.5 py-0.5 text-[10px] transition-colors',
                typeFilter === t.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {query ? `Không có note nào khớp "${query}"` : 'Chưa có note nào'}
          </div>
        ) : (
          <ul>
            {filtered.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                isSelected={note.id === selectedId}
                onClick={() => onSelect(note.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer count */}
      <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        {filtered.length} / {notes.length} notes
      </div>
    </div>
  );
}

// ============================================================
function NoteRow({
  note,
  isSelected,
  onClick,
}: {
  note: Note;
  isSelected: boolean;
  onClick: () => void;
}) {
  // Strip HTML để preview text
  const preview = note.content.replace(/<[^>]+>/g, '').slice(0, 80);

  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          'w-full border-b border-border px-3 py-2 text-left transition-colors',
          isSelected
            ? 'bg-popover'
            : 'hover:bg-popover/50',
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div
            className={cn(
              'truncate text-sm',
              isSelected ? 'font-medium text-foreground' : 'text-foreground',
            )}
          >
            {note.title || 'Untitled'}
          </div>
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
            {note.type}
          </span>
        </div>
        {preview && (
          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{preview}</div>
        )}
      </button>
    </li>
  );
}
