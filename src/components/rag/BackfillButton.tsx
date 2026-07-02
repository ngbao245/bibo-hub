import { useEffect, useState } from 'react';
import { Database, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

import { runBackfill, type BackfillProgress } from '@/lib/rag/backfill';
import { subscribeQueue, type QueueSnapshot } from '@/lib/rag/embed-queue';
import { useRagStore } from '@/stores/ragStore';

// ============================================================
// BackfillButton — manual reindex toàn bộ data
// ============================================================
//
// Click → diff source vs Supabase, enqueue embed/delete jobs.
// Progress hiển thị qua callback. Queue tự drain background.
//
// Nhúng vào RagConfigManager hoặc UI search empty state.
// ============================================================

export default function BackfillButton({
  variant = 'default',
}: {
  variant?: 'default' | 'compact';
}) {
  const status = useRagStore((s) => s.status);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BackfillProgress | null>(null);
  const [queue, setQueue] = useState<QueueSnapshot>({ pending: 0, running: 0 });

  useEffect(() => subscribeQueue(setQueue), []);

  const disabled = status !== 'ready' || running;

  async function handleClick() {
    if (status !== 'ready') {
      toast.error('RAG chưa sẵn sàng', {
        description: 'Setup Gemini key trong Setting trước.',
      });
      return;
    }

    setRunning(true);
    setProgress({ phase: 'notes', total: 0, done: 0, enqueued: 0 });

    try {
      const result = await runBackfill(setProgress);
      const total =
        result.notes.enqueued + result.tasks.enqueued + result.highlights.enqueued;
      const gc = result.notes.gced + result.tasks.gced + result.highlights.gced;

      toast.success('Backfill enqueue xong', {
        description: `${total} embed + ${gc} delete đang chạy background.`,
      });
    } catch (err) {
      toast.error('Backfill thất bại', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  if (variant === 'compact') {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={disabled}
        className="gap-1.5"
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        Backfill
      </Button>
    );
  }

  return (
    <div className="space-y-2 border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">Reindex toàn bộ data</span>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleClick}
          disabled={disabled}
          className="gap-1.5"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {running ? 'Đang quét...' : 'Backfill'}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Diff notes / tasks / highlights với rag_embeddings, embed những item
        chưa có hoặc đã đổi nội dung. Garbage collect row stale.
      </p>

      {progress && (
        <div className="border border-border bg-card p-2 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono uppercase text-muted-foreground">
              {progress.phase}
            </span>
            <span className="font-mono text-foreground">
              {progress.done}/{progress.total}
            </span>
          </div>
          {progress.total > 0 && (
            <div className="h-1 w-full overflow-hidden bg-border">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {(queue.pending > 0 || queue.running > 0) && (
        <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
          <span>Queue background:</span>
          <span className="font-mono">
            <span className="text-foreground">{queue.running}</span> đang chạy ·
            <span className="ml-1 text-foreground">{queue.pending}</span> chờ
          </span>
        </div>
      )}
    </div>
  );
}