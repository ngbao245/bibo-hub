// ============================================================
// PDF Studio — Drop Zone component
// ============================================================

import { useRef, useState, useCallback } from 'react';
import { Upload, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SUPPORTED_INPUT_EXTENSIONS } from '../lib/formats';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSizeMb?: number;
}

const ACCEPT = Array.from(SUPPORTED_INPUT_EXTENSIONS)
  .map((ext) => `.${ext}`)
  .join(',');

export function DropZone({ onFiles, disabled, maxFiles = 10, maxFileSizeMb = 50 }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    onFiles(Array.from(files));
  }, [onFiles]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const onDragLeave = () => setIsDragOver(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Reset input so same files can be re-selected
      e.target.value = '';
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Kéo thả hoặc chọn file để chuyển đổi"
      aria-disabled={disabled}
      className={cn(
        'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/30',
        disabled && 'pointer-events-none opacity-50',
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={onKeyDown}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={onInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className={cn(
        'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
        isDragOver ? 'bg-primary/15' : 'bg-muted',
      )}>
        {isDragOver
          ? <Upload className="h-5 w-5 text-primary" />
          : <FolderOpen className="h-5 w-5 text-muted-foreground" />
        }
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {isDragOver ? 'Thả file vào đây' : 'Kéo thả file hoặc click để chọn'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, Word, Excel, PowerPoint, PNG, JPG, EPUB
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          Tối đa {maxFiles} file · {maxFileSizeMb} MB/file
        </p>
      </div>
    </div>
  );
}
