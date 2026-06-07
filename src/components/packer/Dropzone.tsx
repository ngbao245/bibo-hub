import { useRef, useState, type DragEvent } from 'react';
import { FolderUp } from 'lucide-react';
import { cn } from '@/lib/cn';

// ============================================================
// Dropzone - drop folder hoặc click chọn folder
// ============================================================
//
// Browser only support `webkitdirectory` cho folder picker.
// Drag-drop folder: dùng DataTransferItem.webkitGetAsEntry().
// ============================================================

interface DropzoneProps {
  onFiles: (files: { file: File; path: string }[]) => void;
  disabled?: boolean;
}

export default function Dropzone({ onFiles, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Folders to skip entirely — không hiển thị trong tree
  const SKIP_FOLDERS = ['node_modules', '.git', 'dist', 'build', '.next', '.vite', '.turbo', 'coverage'];

  function shouldSkipPath(path: string): boolean {
    const parts = path.split('/');
    return parts.some((p) => SKIP_FOLDERS.includes(p));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const mapped = files
      .map((f) => ({ file: f, path: f.webkitRelativePath || f.name }))
      .filter((f) => !shouldSkipPath(f.path));
    onFiles(mapped);
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;

    const items = Array.from(e.dataTransfer.items);
    const collected: { file: File; path: string }[] = [];

    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        await traverse(entry, '', collected);
      }
    }

    if (collected.length > 0) {
      onFiles(collected.filter((f) => !shouldSkipPath(f.path)));
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-border bg-card py-10 text-center transition-colors',
        dragOver && 'border-primary bg-popover',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <FolderUp className="mb-2 h-8 w-8 text-primary" />
      <p className="text-sm font-medium text-foreground">Kéo thả thư mục project vào đây</p>
      <p className="mt-1 text-xs text-muted-foreground">hoặc click để chọn</p>

      <input
        ref={inputRef}
        type="file"
        // @ts-expect-error webkitdirectory không có trong type
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}

// ============================================================
// Traverse folder entry recursively (drag-drop folder support)
// ============================================================
// Folders to skip during traverse (instant — never enter these)
const SKIP_TRAVERSE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.vite', '.turbo', 'coverage']);

async function traverse(
  entry: FileSystemEntry,
  parentPath: string,
  out: { file: File; path: string }[],
): Promise<void> {
  // Skip heavy folders entirely at traverse level
  if (entry.isDirectory && SKIP_TRAVERSE.has(entry.name)) {
    return;
  }

  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isFile) {
    const file = await getFile(entry as FileSystemFileEntry);
    if (file) out.push({ file, path });
    return;
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries = await readAllEntries(reader);
    for (const e of entries) {
      await traverse(e, path, out);
    }
  }
}

function getFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(resolve, () => resolve(null));
  });
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    function readBatch() {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(all);
          } else {
            all.push(...entries);
            readBatch();
          }
        },
        reject,
      );
    }
    readBatch();
  });
}
