// ============================================================
// PDF Studio Shared — Add file placeholder card (dashed border)
// ============================================================
// 228x302 matching FilePageCard. Cuối list, click → open file picker.
// ============================================================

import { Plus } from 'lucide-react';
import { useRef } from 'react';

interface AddFileCardProps {
  /** Called when user selects file(s) */
  onFiles: (files: File[]) => void;
  /** Accept mime types */
  accept?: string;
  /** Allow multiple files */
  multiple?: boolean;
  /** Label text */
  label?: string;
}

export function AddFileCard({
  onFiles,
  accept = '.pdf',
  multiple = true,
  label = 'Them file',
}: AddFileCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
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
        className="group flex h-[302px] w-[228px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border transition-all hover:border-foreground/30 hover:bg-muted/30"
      >
        <span className="flex flex-col items-center gap-2 text-muted-foreground transition-colors group-hover:text-foreground">
          <Plus className="h-10 w-10" strokeWidth={1.5} />
          <span className="text-xs font-medium">{label}</span>
        </span>
      </button>
    </>
  );
}
