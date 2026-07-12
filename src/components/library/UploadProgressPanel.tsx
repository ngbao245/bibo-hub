import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileArchive,
  FileUp,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';
import type { UploadProgress, UploadStage } from '@/api/library/books';

export interface UploadItem {
  id: string;
  filename: string;
  progress: UploadProgress;
}

const STAGE_LABEL: Record<UploadStage, string> = {
  pending: 'Chờ',
  compressing: 'Đang nén PDF',
  'extracting-cover': 'Đang tạo bìa',
  'uploading-file': 'Đang tải file',
  'uploading-cover': 'Đang tải bìa',
  saving: 'Đang lưu',
  done: 'Hoàn tất',
  error: 'Lỗi',
};

interface Props {
  items: UploadItem[];
  onDismiss: (id: string) => void;
  onClearDone: () => void;
}

export default function UploadProgressPanel({ items, onDismiss, onClearDone }: Props) {
  if (items.length === 0) return null;
  const allDone = items.every(
    (it) => it.progress.stage === 'done' || it.progress.stage === 'error',
  );

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 border border-zinc-700 bg-zinc-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <FileUp className="h-3.5 w-3.5" />
          <span className="font-medium">Uploads</span>
          <span className="text-zinc-500">{items.length}</span>
        </div>
        {allDone && (
          <button
            onClick={onClearDone}
            className="text-xs text-zinc-500 hover:text-zinc-200"
          >
            Clear
          </button>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto">
        {items.map((it) => (
          <UploadRow key={it.id} item={it} onDismiss={() => onDismiss(it.id)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Ngưỡng thời gian (ms) coi là "long-running" cho stage compressing —
 * sau ngưỡng này hiển thị note "cold start, có thể mất 1-2 phút".
 */
const LONG_COMPRESS_THRESHOLD_MS = 30_000;

function UploadRow({ item, onDismiss }: { item: UploadItem; onDismiss: () => void }) {
  const { stage, percent, message, compressSummary } = item.progress;
  const isDone = stage === 'done';
  const isError = stage === 'error';
  const isActive = !isDone && !isError;
  const isCompressing = stage === 'compressing';

  const compressStartRef = useRef<number | null>(null);
  const [longCompress, setLongCompress] = useState(false);

  // Track thời điểm bắt đầu compress. Nếu > 30s → set longCompress.
  useEffect(() => {
    if (isCompressing) {
      if (compressStartRef.current === null) {
        compressStartRef.current = Date.now();
      }
      const timer = setInterval(() => {
        if (compressStartRef.current !== null) {
          const elapsed = Date.now() - compressStartRef.current;
          if (elapsed >= LONG_COMPRESS_THRESHOLD_MS) {
            setLongCompress(true);
            clearInterval(timer);
          }
        }
      }, 5000);
      return () => clearInterval(timer);
    }
    compressStartRef.current = null;
    setLongCompress(false);
    return undefined;
  }, [isCompressing]);

  return (
    <div className="border-b border-zinc-800 px-3 py-2 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {isError ? (
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          ) : isDone ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-sky-400" />
          ) : isCompressing ? (
            <FileArchive className="h-3.5 w-3.5 text-sky-400" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-zinc-200" title={item.filename}>
            {item.filename}
          </p>
          <p className={`mt-0.5 text-[10px] ${isError ? 'text-red-400' : 'text-zinc-500'}`}>
            {message ?? STAGE_LABEL[stage]}
          </p>
          {isCompressing && longCompress && (
            <p className="mt-0.5 text-[10px] text-amber-400">
              (Cloud Run cold start, sách lớn có thể mất 1-2 phút)
            </p>
          )}
          {compressSummary && (
            <p className="mt-0.5 text-[10px] text-emerald-400">{compressSummary}</p>
          )}
        </div>
        {(isDone || isError) && (
          <button
            onClick={onDismiss}
            className="text-zinc-500 hover:text-zinc-200"
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {isActive && (
        <div className="relative mt-1.5 h-1 w-full overflow-hidden bg-zinc-800">
          <div
            className="h-full bg-sky-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}