import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileUp, Loader2, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getPdfPageCount } from '@/lib/library/pdf-page-count';
import type { Book } from '@/lib/library/types';

interface Props {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (book: Book, newFile: File) => void;
  isReplacing?: boolean;
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReplaceBookDialog({
  book,
  open,
  onOpenChange,
  onConfirm,
  isReplacing = false,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPages, setNewPages] = useState<number | null>(null);
  const [parsingPages, setParsingPages] = useState(false);

  // Reset khi dialog open lần mới
  useEffect(() => {
    if (open) {
      setNewFile(null);
      setNewPages(null);
    }
  }, [open]);

  async function handleFileSelect(file: File | null) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) return;
    setNewFile(file);
    setNewPages(null);
    setParsingPages(true);
    try {
      // Phase 1: chỉ parse page file mới. Compare với file cũ cần fetch
      // qua signed URL + parse local (tốn bandwidth), tách phase riêng
      // nếu thực tế thấy user hay upload file lệch trang.
      const np = await getPdfPageCount(file);
      setNewPages(np);
    } finally {
      setParsingPages(false);
    }
  }

  if (!book) return null;

  const canConfirm = !!newFile && !parsingPages && !isReplacing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Replace file
          </DialogTitle>
          <DialogDescription>
            Giữ nguyên book_id + highlights + progress. Chỉ đổi file PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Sách hiện tại</p>
            <p className="mt-1 font-medium text-foreground">{book.title}</p>
            {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
          </div>

          {!newFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 border-2 border-dashed border-border bg-muted/20 py-8 hover:border-primary hover:bg-primary/5"
            >
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-foreground">Chọn file PDF mới</span>
              <span className="text-xs text-muted-foreground">Compress tự động qua iLovePDF</span>
            </button>
          ) : (
            <div className="space-y-2 border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">File mới</p>
                  <p className="mt-1 truncate font-medium text-foreground" title={newFile.name}>
                    {newFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(newFile.size)}
                    {parsingPages ? (
                      <span className="ml-1 inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        đang parse trang...
                      </span>
                    ) : newPages !== null ? (
                      <span className="ml-1">· {newPages} trang</span>
                    ) : null}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewFile(null)}
                  disabled={isReplacing}
                >
                  Đổi file
                </Button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          />

          <div className="flex items-start gap-2 border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Highlights của user sẽ giữ nguyên vị trí normalized (%). Nếu file mới có số trang lệch nhiều so với file cũ, highlight sẽ rơi vào trang sai. Nên chọn file cùng edition.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isReplacing}>
            Huỷ
          </Button>
          <Button
            onClick={() => newFile && onConfirm(book, newFile)}
            disabled={!canConfirm}
            className="gap-2"
          >
            {isReplacing && <Loader2 className="h-4 w-4 animate-spin" />}
            {isReplacing ? 'Đang replace...' : 'Replace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}