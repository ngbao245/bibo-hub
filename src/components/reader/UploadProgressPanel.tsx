import { CheckCircle2, FileUp, Loader2, X, AlertTriangle } from 'lucide-react';
import type { UploadProgress, UploadStage } from '@/api/reader/books';

export interface UploadItem {
  id: string;
  filename: string;
  progress: UploadProgress;
}

const STAGE_LABEL: Record<UploadStage, string> = {
  pending: 'Chờ',
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

function UploadRow({ item, onDismiss }: { item: UploadItem; onDismiss: () => void }) {
  const { stage, percent, message } = item.progress;
  const isDone = stage === 'done';
  const isError = stage === 'error';
  const isActive = !isDone && !isError;

  return (
    <div className="border-b border-zinc-800 px-3 py-2 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {isError ? (
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          ) : isDone ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-sky-400" />
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
        <div className="mt-1.5 h-1 w-full overflow-hidden bg-zinc-800">
          <div
            className="h-full bg-sky-500 transition-all duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}