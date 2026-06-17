import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';

// =============================================================
// Skeleton placeholder cho lúc reader đang load.
// Render full reader layout: header dummy (toàn bộ button disable) +
// content lines pulse → khi reader thật mount, layout không nhảy chỗ.
// =============================================================

const LINE_LENGTHS = [
  '92%', '88%', '95%', '70%',
  '90%', '85%', '93%', '60%',
  '88%', '92%', '78%', '95%',
  '90%', '50%',
];

interface Props {
  /** Hiện title trong header dummy (mặc định để trống) */
  title?: string;
  /** Mặc định true. False = chỉ render content (cho dùng nested khi đã có header thật) */
  withHeader?: boolean;
}

export default function ReaderSkeleton({ title, withHeader = true }: Props) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-zinc-950">
      {withHeader && <DummyHeader title={title} />}

      <div className="flex flex-1 items-start justify-center overflow-hidden p-8">
        <div className="flex w-full max-w-prose flex-col gap-3 px-4">
          <div className="mb-3 h-7 w-2/3 animate-pulse bg-zinc-800" />
          {LINE_LENGTHS.map((w, i) => (
            <div
              key={i}
              className="h-3 animate-pulse bg-zinc-800/70"
              style={{ width: w, animationDelay: `${(i % 5) * 80}ms` }}
            />
          ))}
          <div className="h-3" />
          {LINE_LENGTHS.slice(0, 6).map((w, i) => (
            <div
              key={`p2-${i}`}
              className="h-3 animate-pulse bg-zinc-800/70"
              style={{ width: w, animationDelay: `${(i % 5) * 80 + 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Header giả — toàn bộ control disabled. Title hiện skeleton bar nếu trống.
function DummyHeader({ title }: { title?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Link to="/reader" className="text-zinc-400 hover:text-zinc-100" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {title ? (
          <span className="truncate text-sm text-zinc-200">{title}</span>
        ) : (
          <div className="h-3 w-40 animate-pulse bg-zinc-800" />
        )}
      </div>
      <div className="flex items-center gap-1 opacity-60">
        <button disabled className="cursor-default p-1.5 text-zinc-500" aria-hidden>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="h-5 w-12 border border-zinc-800 bg-zinc-900" />
        <span className="text-xs text-zinc-600">/ ?</span>
        <button disabled className="cursor-default p-1.5 text-zinc-500" aria-hidden>
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-zinc-800" />
        <button disabled className="cursor-default p-1.5 text-zinc-500" aria-hidden>
          <Minus className="h-4 w-4" />
        </button>
        <span className="font-mono text-xs text-zinc-600">—</span>
        <button disabled className="cursor-default p-1.5 text-zinc-500" aria-hidden>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}