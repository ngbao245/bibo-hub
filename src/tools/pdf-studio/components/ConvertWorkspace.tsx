// ============================================================
// PDF Studio — Convert workspace (previously the "Chuyển đổi" tab)
// ============================================================
// Drag & drop → select output format → batch convert via server.
// ============================================================

import { useCallback } from 'react';
import { ArrowLeft, FileOutput, Play, Square, RotateCcw, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared';
import { DropZone } from './DropZone';
import { JobRow } from './JobRow';
import { BatchSummary } from './BatchSummary';
import { usePdfStudioStore, selectReadyCount, selectFailedCount } from '../store';
import { useFileProcessor } from '../hooks/useFileProcessor';
import { useConversionQueue } from '../hooks/useConversionQueue';
import { getOutput, deleteOutput, markDownloaded } from '../lib/idb-storage';
import type { OutputFormat } from '@/lib/pdf-studio/types';
import type { BatchLimits } from '../lib/formats';

const DEFAULT_LIMITS: BatchLimits = {
  maxFiles: 10,
  maxFileSizeMb: 50,
  maxBatchSizeMb: 200,
};

const OUTPUT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'pptx', label: 'PowerPoint (.pptx)' },
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'epub', label: 'EPUB' },
  { value: 'pdf_ocr', label: 'PDF (OCR)' },
];

interface ConvertWorkspaceProps {
  onBack: () => void;
}

export function ConvertWorkspace({ onBack }: ConvertWorkspaceProps) {
  const {
    jobs,
    defaultOutputFormat,
    isRunning,
    updateJob,
    removeJob,
    setDefaultOutputFormat,
    setRunning,
    clearBatch,
    retryFailed,
  } = usePdfStudioStore();

  const { processFiles } = useFileProcessor(DEFAULT_LIMITS);
  const { stopAll } = useConversionQueue();

  const totalSizeBytes = jobs.reduce((sum, j) => sum + j.fileSize, 0);
  const readyCount = selectReadyCount(jobs);
  const failedCount = selectFailedCount(jobs);

  const handleOutputChange = useCallback(
    (localId: string, format: OutputFormat) => {
      updateJob(localId, { outputFormat: format });
    },
    [updateJob],
  );

  const handleRemove = useCallback(
    (localId: string) => {
      removeJob(localId);
    },
    [removeJob],
  );

  const handleRetry = useCallback(
    (localId: string) => {
      updateJob(localId, { status: 'pending', errorMessage: undefined });
    },
    [updateJob],
  );

  const handleDownload = useCallback(
    async (localId: string) => {
      const job = jobs.find((j) => j.localId === localId);
      if (!job) return;
      const storageKey = job.jobId ?? job.localId;
      const stored = await getOutput(storageKey);
      if (!stored) {
        const fallback = await getOutput(localId);
        if (!fallback) return;
        const url = URL.createObjectURL(fallback.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fallback.filename;
        a.click();
        URL.revokeObjectURL(url);
        await markDownloaded(localId);
        return;
      }
      const url = URL.createObjectURL(stored.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = stored.filename;
      a.click();
      URL.revokeObjectURL(url);
      await markDownloaded(storageKey);
    },
    [jobs],
  );

  const handleDownloadAll = useCallback(async () => {
    const readyJobs = jobs.filter((j) => j.status === 'ready' && j.outputReady);
    for (const job of readyJobs) {
      await handleDownload(job.localId);
    }
  }, [jobs, handleDownload]);

  const handleStart = useCallback(() => {
    setRunning(true);
  }, [setRunning]);

  const handleStop = useCallback(() => {
    stopAll();
  }, [stopAll]);

  const handleClear = useCallback(async () => {
    for (const job of jobs) {
      if (['ready', 'failed', 'cancelled'].includes(job.status)) {
        await deleteOutput(job.localId).catch(() => {});
      }
    }
    clearBatch();
  }, [jobs, clearBatch]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FileOutput className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Chuyen doi dinh dang</h2>
      </div>

      {/* Drop zone */}
      <DropZone
        onFiles={processFiles}
        disabled={isRunning}
        maxFiles={DEFAULT_LIMITS.maxFiles}
        maxFileSizeMb={DEFAULT_LIMITS.maxFileSizeMb}
      />

      {/* Batch config + actions */}
      {jobs.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Output mac dinh:</span>
              <select
                value={defaultOutputFormat ?? ''}
                onChange={(e) =>
                  setDefaultOutputFormat((e.target.value || null) as OutputFormat | null)
                }
                disabled={isRunning}
                className="h-8 w-44 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Chon dinh dang...</option>
                {OUTPUT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {failedCount > 0 && !isRunning && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={retryFailed}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Thu lai ({failedCount})
                </Button>
              )}
              {readyCount > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadAll}>
                  <Download className="h-3.5 w-3.5" />
                  Tai tat ca ({readyCount})
                </Button>
              )}
              {!isRunning ? (
                <Button size="sm" className="gap-1.5" onClick={handleStart}>
                  <Play className="h-3.5 w-3.5" />
                  Bat dau
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleStop}>
                  <Square className="h-3.5 w-3.5" />
                  Dung
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleClear}
                title="Xoa tat ca"
                disabled={isRunning}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <BatchSummary
            jobs={jobs}
            totalSizeBytes={totalSizeBytes}
            maxBatchSizeMb={DEFAULT_LIMITS.maxBatchSizeMb}
          />

          <div className="space-y-2">
            {jobs.map((job) => (
              <JobRow
                key={job.localId}
                job={job}
                onOutputChange={handleOutputChange}
                onRemove={handleRemove}
                onRetry={handleRetry}
                onDownload={handleDownload}
                isRunning={isRunning}
              />
            ))}
          </div>
        </>
      )}

      {jobs.length === 0 && (
        <EmptyState
          icon={FileOutput}
          title="Chua co file nao"
          description="Keo tha hoac click vung tren de them file can chuyen doi."
        />
      )}
    </div>
  );
}
