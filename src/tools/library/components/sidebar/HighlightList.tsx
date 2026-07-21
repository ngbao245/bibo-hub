import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDeleteHighlight, useHighlights } from '@/tools/library/api/highlights';
import type { Highlight } from '@/tools/library/lib/types';

interface Props {
  bookId: string;
  /** Click vô 1 highlight để jump tới vị trí (CFI hoặc page) */
  onJump: (h: Highlight) => void;
}

export default function HighlightList({ bookId, onJump }: Props) {
  const query = useHighlights(bookId);
  const del = useDeleteHighlight();

  if (query.isLoading) {
    return <p className="p-4 text-xs text-zinc-500">Loading…</p>;
  }
  if (!query.data || query.data.length === 0) {
    return (
      <p className="p-4 text-xs text-zinc-500">
        Chưa có highlight. Chọn text trong sách → bấm Highlight hoặc Note để bắt đầu.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-800">
      {query.data.map((h) => (
        <li key={h.id} className="group p-3">
          <button
            onClick={() => onJump(h)}
            className="block w-full text-left"
            title="Jump to highlight"
          >
            <div className={cn('mb-1 h-1 w-8', colorBar(h.color))} />
            <p className="line-clamp-3 text-xs text-zinc-200">{h.text}</p>
            {h.note && (
              <p className="mt-1 line-clamp-2 border-l-2 border-zinc-700 pl-2 text-[11px] italic text-zinc-400">
                {h.note}
              </p>
            )}
            <p className="mt-1 text-[10px] text-zinc-600">
              {new Date(h.created_at).toLocaleDateString()}
              {h.location.type === 'pdf' && ` · trang ${h.location.page}`}
            </p>
          </button>
          <div className="mt-1 flex justify-end opacity-0 group-hover:opacity-100">
            <button
              onClick={() => del.mutate({ id: h.id, bookId })}
              className="text-[10px] text-zinc-500 hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function colorBar(color: string): string {
  switch (color) {
    case 'blue':
      return 'bg-blue-500';
    case 'green':
      return 'bg-green-500';
    case 'red':
      return 'bg-red-500';
    default:
      return 'bg-yellow-400';
  }
}