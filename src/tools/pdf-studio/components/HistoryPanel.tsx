// ============================================================
// PDF Studio — History panel
// ============================================================

import { History, FileOutput, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/shared';
import { useBatchHistory } from '../api/pdf-studio-api';
import type { PdfStudioBatch } from '@/lib/pdf-studio/types';

interface HistoryPanelProps {
  onBack: () => void;
  onOpenBatch: (batchId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function BatchCard({ batch, onOpen }: { batch: PdfStudioBatch; onOpen: () => void }) {
  const isComplete = batch.status === 'completed';
  const isFailed = batch.status === 'failed';
  const isPartial = batch.status === 'partial';

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/30 cursor-pointer transition-colors"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
    >
      <div className="flex-shrink-0">
        {isComplete && <CheckCircle className="h-5 w-5 text-success" />}
        {isFailed && <XCircle className="h-5 w-5 text-destructive" />}
        {isPartial && <XCircle className="h-5 w-5 text-warning" />}
        {batch.status === 'active' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {batch.status === 'cancelled' && <XCircle className="h-5 w-5 text-muted-foreground" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          Batch · {batch.total_files} file
          {batch.default_output_format && ` → ${batch.default_output_format.toUpperCase()}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(batch.created_at)}
          {' · '}
          {batch.completed_files} xong
          {batch.failed_files > 0 && `, ${batch.failed_files} lỗi`}
        </p>
      </div>

      <span className="text-xs text-muted-foreground capitalize">
        {batch.status === 'active' ? 'đang chạy' : batch.status}
      </span>
    </div>
  );
}

export function HistoryPanel({ onBack, onOpenBatch }: HistoryPanelProps) {
  const { data: batches, isLoading, isError, error, refetch } = useBatchHistory();

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <FileOutput className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">PDF Studio</h1>
        <span className="text-sm text-muted-foreground">Lịch sử</span>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Quay lại
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <ErrorState message={error?.message ?? 'Không tải được lịch sử'} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && batches && batches.length === 0 && (
          <EmptyState
            icon={History}
            title="Chưa có lịch sử"
            description="Lịch sử batch sẽ xuất hiện sau khi bạn chuyển đổi file."
            compact
          />
        )}

        {!isLoading && !isError && batches && batches.length > 0 && (
          <div className="space-y-2">
            {batches.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                onOpen={() => onOpenBatch(batch.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
