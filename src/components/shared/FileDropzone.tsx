import { useId, useRef, useState, type DragEvent } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FileDropzoneProps {
  /** MIME types / extensions cho input file, VD "application/pdf,image/png,image/jpeg". */
  accept?: string;
  /** Cho phép chọn nhiều file. Default: false. */
  multiple?: boolean;
  /** Hint text hiển thị dưới label chính, VD "PDF, PNG, JPG up to 10MB". */
  hint?: string;
  /** Callback khi user chọn file (qua click hoặc drop). */
  onFilesSelected: (files: File[]) => void;
  className?: string;
}

/**
 * Dropzone thật — có `<input type="file">` ẩn liên kết qua `<label htmlFor>`,
 * nên click/Enter/Space đều mở file picker OS thật (native label behavior,
 * không cần thêm keyboard handler). Đây thay cho pattern cũ chỉ có
 * `<span>browse</span>` trông giống link nhưng không làm gì (false affordance).
 *
 * @example
 * <FileDropzone
 *   accept="application/pdf,image/png,image/jpeg"
 *   hint="PDF, PNG, JPG up to 10MB"
 *   onFilesSelected={(files) => console.log(files)}
 * />
 */
export function FileDropzone({ accept, multiple, hint, onFilesSelected, className }: FileDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesSelected(files);
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      aria-label={hint ? `Chọn hoặc thả file. ${hint}` : 'Chọn hoặc thả file'}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition-colors',
        'focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30',
        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50',
        className,
      )}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFilesSelected(files);
        }}
      />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Drop files here or <span className="text-primary underline-offset-2 hover:underline">browse</span>
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </label>
  );
}
