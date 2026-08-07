// ============================================================
// PDF Studio — Job row in batch list
// ============================================================

import { FileText, AlertTriangle, CheckCircle, XCircle, Loader2, RefreshCw, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared';
import type { LocalJob, JobStage } from '../store';
import type { OutputFormat } from '@/lib/pdf-studio/types';
import { getValidOutputs } from '../lib/formats';

interface JobRowProps {
  job: LocalJob;
  onOutputChange: (localId: string, format: OutputFormat) => void;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
  onDownload: (localId: string) => void;
  isRunning: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Chờ xử lý',
  validating: 'Đang phân tích...',
  invalid: 'Định dạng không hỗ trợ',
  pending: 'Chờ chuyển đổi',
  uploading: 'Đang tải lên...',
  processing: 'Đang chuyển đổi...',
  caching_result: 'Đang lưu kết quả...',
  ready: 'Sẵn sàng tải',
  failed: 'Thất bại',
  cancelled: 'Đã huỷ',
  needs_file: 'Cần chọn lại file',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StageIndicator({ stages }: { stages: JobStage[] }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      {stages.map((stage, i) => (
        <span key={i} className="flex items-center gap-0.5 text-[10px]">
          {stage.status === 'done' && <span className="text-success">✓</span>}
          {stage.status === 'running' && <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />}
          {stage.status === 'pending' && <span className="text-muted-foreground">—</span>}
          {stage.status === 'failed' && <span className="text-destructive">✗</span>}
          <span className={cn(
            stage.status === 'done' && 'text-success',
            stage.status === 'running' && 'text-primary',
            stage.status === 'failed' && 'text-destructive',
            stage.status === 'pending' && 'text-muted-foreground',
          )}>
            {stage.name}
          </span>
          {i < stages.length - 1 && <span className="text-muted-foreground/50 mx-0.5">→</span>}
        </span>
      ))}
    </div>
  );
}

export function JobRow({
  job,
  onOutputChange,
  onRemove,
  onRetry,
  onDownload,
  isRunning,
}: JobRowProps) {
  const validOutputs = getValidOutputs(job.inputFormat, job.scanType);
  const isActive = ['uploading', 'processing', 'caching_result'].includes(job.status);
  const canRemove = !isActive && !isRunning;
  const canRetry = job.status === 'failed' && !isRunning;
  const canDownload = job.status === 'ready' && job.outputReady;
  const canChangeOutput = ['idle', 'pending', 'invalid'].includes(job.status) && !isRunning;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm transition-[color,background-color,border-color] duration-150 ease-in-out elev-surface',
      job.status === 'invalid' && 'border-destructive/30 bg-destructive/5',
      job.status === 'ready' && 'border-success/30 bg-success/5',
    )}>
      {/* Status icon */}
      <div className="flex-shrink-0">
        {job.status === 'ready' && <CheckCircle className="h-4 w-4 text-success" />}
        {job.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
        {job.status === 'invalid' && <XCircle className="h-4 w-4 text-destructive" />}
        {job.status === 'needs_file' && <AlertTriangle className="h-4 w-4 text-warning" />}
        {job.status === 'validating' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {isActive && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {['idle', 'pending'].includes(job.status) && <FileText className="h-4 w-4 text-muted-foreground" />}
      </div>

      {/* Filename + status + stages */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{job.filename}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(job.fileSize)} · {job.inputFormat.toUpperCase()}
          {job.scanType && job.inputFormat === 'pdf' && (
            <span className={cn(
              'ml-1.5 rounded px-1 text-[10px]',
              job.scanType === 'scan' && 'bg-primary/10 text-primary',
              job.scanType === 'mixed' && 'bg-warning/10 text-warning',
              job.scanType === 'text' && 'bg-muted text-muted-foreground',
            )}>
              {job.scanType}
            </span>
          )}
          {job.ocrRequired && (
            <span className="ml-1.5 rounded bg-primary/10 px-1 text-[10px] text-primary">
              OCR
            </span>
          )}
        </p>
        {job.stages && job.stages.length > 0 && isActive && (
          <StageIndicator stages={job.stages} />
        )}
        {job.status === 'failed' && job.errorMessage && (
          <ErrorState compact message={job.errorMessage} />
        )}
      </div>

      {/* Arrow */}
      <span className="flex-shrink-0 text-xs text-muted-foreground">→</span>

      {/* Output format */}
      <div className="flex-shrink-0 w-36">
        {canChangeOutput && validOutputs.length > 1 ? (
          <select
            value={job.outputFormat}
            onChange={(e) => onOutputChange(job.localId, e.target.value as OutputFormat)}
            className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {validOutputs.map((o) => (
              <option key={o.format} value={o.format}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {validOutputs.find((o) => o.format === job.outputFormat)?.label ?? job.outputFormat.toUpperCase()}
          </span>
        )}
      </div>

      {/* Status label */}
      <div className="w-32 flex-shrink-0 text-right">
        <span className={cn(
          'text-xs',
          job.status === 'ready' && 'text-success',
          job.status === 'failed' && 'text-destructive',
          !['ready', 'failed'].includes(job.status) && 'text-muted-foreground',
        )}>
          {STATUS_LABEL[job.status] ?? job.status}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        {canDownload && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-success hover:bg-success/10"
            onClick={() => onDownload(job.localId)}
            title="Tải file"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
        {canRetry && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onRetry(job.localId)}
            title="Thử lại"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
        {canRemove && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(job.localId)}
            title="Xoá"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
