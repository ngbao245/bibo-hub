// ============================================================
// PDF Studio Shared — Inline add button between cards
// ============================================================
// Wrapper slot 32x302 giữa 2 card. Hover slot → button "+" hiện.
// Bấm → file picker → onFiles(files) chèn tại vị trí này (parent quyết index).
// ============================================================

import { Plus } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/cn';

interface InlineAddButtonProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  className?: string;
  /** Disable tương tác (VD khi đang drag, đang loading) */
  disabled?: boolean;
}

export function InlineAddButton({
  onFiles,
  accept = '.pdf',
  className,
  disabled = false,
}: InlineAddButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        'group/slot m-1 flex h-[302px] w-14 shrink-0 items-center justify-center',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Chèn file tại đây"
        aria-label="Chèn file tại vị trí này"
        className="flex h-8 w-8 cursor-pointer items-center justify-center border border-border/60 bg-background/60 text-muted-foreground/60 shadow-sm transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-md group-hover/slot:border-border group-hover/slot:bg-background group-hover/slot:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
