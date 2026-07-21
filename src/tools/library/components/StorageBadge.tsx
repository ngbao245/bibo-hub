import { HardDrive } from 'lucide-react';
import { useReaderStorageUsage } from '@/tools/library/api/usage';
import { Skeleton } from '@/components/ui/skeleton';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v >= 10 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${UNITS[i]}`;
}

/**
 * Badge nhỏ hiển thị "245 MB / 1 GB" + thanh progress mảnh.
 * Dùng trong header Library. Click không làm gì (chỉ info).
 */
export default function StorageBadge() {
  const { data, isLoading, error } = useReaderStorageUsage();

  if (isLoading) {
    // Skeleton match footprint của badge thật (icon + text "0 B / 0 B" + bar
    // 16 col wide) → không layout shift khi data về. `bg-zinc-800` để khớp
    // theme Reader chrome (dark).
    return (
      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <HardDrive className="h-3.5 w-3.5 text-zinc-600" />
        <Skeleton className="h-3 w-24 bg-zinc-800" />
        <Skeleton className="h-1 w-16 bg-zinc-800" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <span
        className="flex items-center gap-1.5 text-[11px] text-zinc-600"
        title={error instanceof Error ? error.message : 'Failed to load usage'}
      >
        <HardDrive className="h-3.5 w-3.5" />
        --
      </span>
    );
  }

  const percent = Math.min(100, (data.used / data.limit) * 100);
  // Warn level theo % usage. Vẫn dùng shade vì đây là semantic "warning",
  // không phải accent — đổi theme không ảnh hưởng.
  const barColor =
    percent >= 90 ? 'bg-red-500'
      : percent >= 70 ? 'bg-amber-500'
        : 'bg-sky-500';

  return (
    <div
      className="flex items-center gap-2 text-[11px] text-zinc-400"
      title={`Library shared · ${data.count} object${data.count === 1 ? '' : 's'} · ${percent.toFixed(1)}% used`}
    >
      <HardDrive className="h-3.5 w-3.5 text-zinc-500" />
      <span className="font-mono tabular-nums">
        {formatBytes(data.used)}
        <span className="mx-1 text-zinc-600">/</span>
        {formatBytes(data.limit)}
      </span>
      <span className="h-1 w-16 overflow-hidden rounded-full bg-zinc-800">
        <span
          className={`block h-full ${barColor} transition-all`}
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </span>
    </div>
  );
}