// ============================================================
// PDF Studio — Batch summary bar
// ============================================================

import { Files, CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import type { LocalJob } from '../store';
import { selectActiveCount, selectFailedCount, selectPendingCount, selectReadyCount } from '../store';

interface BatchSummaryProps {
  jobs: LocalJob[];
  totalSizeBytes: number;
  maxBatchSizeMb: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function BatchSummary({ jobs, totalSizeBytes, maxBatchSizeMb }: BatchSummaryProps) {
  const ready = selectReadyCount(jobs);
  const failed = selectFailedCount(jobs);
  const active = selectActiveCount(jobs);
  const pending = selectPendingCount(jobs);
  const total = jobs.length;
  const maxBytes = maxBatchSizeMb * 1024 * 1024;
  const overLimit = totalSizeBytes > maxBytes;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Files className="h-3.5 w-3.5" />
        <span>{total} file</span>
      </span>

      {active > 0 && (
        <span className="flex items-center gap-1.5 text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{active} đang xử lý</span>
        </span>
      )}

      {pending > 0 && (
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>{pending} chờ</span>
        </span>
      )}

      {ready > 0 && (
        <span className="flex items-center gap-1.5 text-success">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>{ready} sẵn sàng</span>
        </span>
      )}

      {failed > 0 && (
        <span className="flex items-center gap-1.5 text-destructive">
          <XCircle className="h-3.5 w-3.5" />
          <span>{failed} thất bại</span>
        </span>
      )}

      <span className={overLimit ? 'text-destructive' : ''}>
        {formatBytes(totalSizeBytes)} / {maxBatchSizeMb} MB
      </span>
    </div>
  );
}
