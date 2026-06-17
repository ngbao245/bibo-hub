import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TocItem {
  id?: string;
  label: string;
  /** EPUB: href (CFI hoặc relative path); PDF: page number */
  target: string | number;
  level: number;
  children?: TocItem[];
}

interface Props {
  items: TocItem[];
  onJump: (target: string | number) => void;
  /** Highlight item nếu match — dùng để show "đang ở chương X" */
  activeTarget?: string | number;
}

export default function TocList({ items, onJump, activeTarget }: Props) {
  if (items.length === 0) {
    return (
      <p className="p-4 text-xs text-zinc-500">
        Không có mục lục. Format file có thể không cung cấp TOC.
      </p>
    );
  }
  return (
    <ul className="py-1">
      {items.map((item, i) => (
        <TocNode key={i} item={item} onJump={onJump} activeTarget={activeTarget} />
      ))}
    </ul>
  );
}

function TocNode({
  item,
  onJump,
  activeTarget,
}: {
  item: TocItem;
  onJump: (target: string | number) => void;
  activeTarget?: string | number;
}) {
  const isActive = activeTarget !== undefined && item.target === activeTarget;
  return (
    <li>
      <button
        onClick={() => onJump(item.target)}
        style={{ paddingLeft: `${0.75 + item.level * 0.75}rem` }}
        className={cn(
          'flex w-full items-center gap-1 py-1.5 pr-3 text-left text-xs transition-colors hover:bg-zinc-900',
          isActive ? 'bg-zinc-900 text-sky-400' : 'text-zinc-300',
        )}
      >
        {item.children && item.children.length > 0 && (
          <ChevronRight className="h-3 w-3 shrink-0 text-zinc-600" />
        )}
        <span className="line-clamp-2">{item.label}</span>
      </button>
      {item.children && item.children.length > 0 && (
        <ul>
          {item.children.map((c, i) => (
            <TocNode key={i} item={c} onJump={onJump} activeTarget={activeTarget} />
          ))}
        </ul>
      )}
    </li>
  );
}