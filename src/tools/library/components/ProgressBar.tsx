import { useRef, useState } from 'react';

interface Props {
  current: number; // 1-based
  total: number;
  /** Click vô track để jump tới page tương ứng */
  onJump: (page: number) => void;
}

/**
 * Progress bar mỏng dưới header reader. Hover hiện tooltip page number,
 * click jump. Đủ to để bấm nhưng không che chữ (h-1.5).
 */
export default function ProgressBar({ current, total, onJump }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ page: number; left: number } | null>(null);

  if (!total || total <= 0) return null;
  const percent = Math.round((current / total) * 100);

  function pageFromEvent(clientX: number): number {
    const t = trackRef.current;
    if (!t) return current;
    const rect = t.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.max(1, Math.min(total, Math.round(ratio * total)));
  }

  return (
    <div className="relative border-b border-zinc-800 bg-zinc-950">
      <div
        ref={trackRef}
        className="group relative h-1.5 cursor-pointer"
        onClick={(e) => onJump(pageFromEvent(e.clientX))}
        onMouseMove={(e) => {
          const t = trackRef.current;
          if (!t) return;
          const rect = t.getBoundingClientRect();
          setHover({ page: pageFromEvent(e.clientX), left: e.clientX - rect.left });
        }}
        onMouseLeave={() => setHover(null)}
      >
        <div className="absolute inset-y-0 left-0 bg-zinc-800" style={{ width: '100%' }} />
        <div
          className="absolute inset-y-0 left-0 bg-sky-500 transition-all"
          style={{ width: `${percent}%` }}
        />
        {hover && (
          <div
            className="pointer-events-none absolute -top-7 -translate-x-1/2 whitespace-nowrap border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200"
            style={{ left: hover.left }}
          >
            Page {hover.page}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-0.5 text-[10px] font-mono text-zinc-500">
        <span>{percent}%</span>
        <span>
          {current} / {total}
        </span>
      </div>
    </div>
  );
}