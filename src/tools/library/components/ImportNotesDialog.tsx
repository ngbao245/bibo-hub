import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileUp, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  matchBook,
  parseNotePack,
  importNotes,
  NotePackError,
  type NotePackV1,
  type BookMatchResult,
} from '@/tools/library/lib/note-pack';
import type { Book } from '@/tools/library/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Books cho fuzzy match. Load từ useBooks() ở caller. */
  books: Array<Pick<Book, 'id' | 'title' | 'author'>>;
  /** Nếu có target = book cụ thể (VD click Import từ book card). Skip match phase. */
  targetBook?: Book | null;
  /** Callback sau khi import xong (invalidate queries). */
  onSuccess?: () => void;
}

interface PackWithMatch {
  pack: NotePackV1;
  match: BookMatchResult | null;
  manualTarget?: string; // book_id user chọn tay
  status: 'pending' | 'importing' | 'done' | 'error';
  message?: string;
  imported?: number;
  skipped?: number;
}

export default function ImportNotesDialog({
  open,
  onOpenChange,
  books,
  targetBook,
  onSuccess,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PackWithMatch[]>([]);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setItems([]);
      setBusy(false);
    }
  }, [open]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setParsing(true);
    try {
      const packs = await parseNotePack(file);
      const withMatch: PackWithMatch[] = packs.map((pack) => {
        // Nếu có targetBook explicit → dùng luôn, skip match logic
        if (targetBook) {
          return {
            pack,
            match: null,
            manualTarget: targetBook.id,
            status: 'pending' as const,
          };
        }
        const match = matchBook(pack, books);
        return { pack, match, status: 'pending' as const };
      });
      setItems(withMatch);
    } catch (err) {
      if (err instanceof NotePackError) {
        toast.error(`File không hợp lệ: ${err.message}`);
      } else {
        toast.error(err instanceof Error ? err.message : 'Parse fail');
      }
    } finally {
      setParsing(false);
    }
  }

  function setManualTarget(index: number, bookId: string) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, manualTarget: bookId } : it)),
    );
  }

  async function runImport() {
    setBusy(true);
    let totalImported = 0;
    let totalSkipped = 0;
    let hasError = false;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const targetId = it.manualTarget ?? it.match?.book.id;
      if (!targetId) {
        setItems((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: 'error', message: 'Chưa chọn sách đích' } : x,
          ),
        );
        hasError = true;
        continue;
      }
      setItems((prev) =>
        prev.map((x, idx) => (idx === i ? { ...x, status: 'importing' } : x)),
      );
      try {
        const result = await importNotes(it.pack, targetId);
        totalImported += result.imported;
        totalSkipped += result.skipped;
        setItems((prev) =>
          prev.map((x, idx) =>
            idx === i
              ? {
                  ...x,
                  status: 'done',
                  imported: result.imported,
                  skipped: result.skipped,
                }
              : x,
          ),
        );
      } catch (err) {
        hasError = true;
        setItems((prev) =>
          prev.map((x, idx) =>
            idx === i
              ? {
                  ...x,
                  status: 'error',
                  message: err instanceof Error ? err.message : 'Import fail',
                }
              : x,
          ),
        );
      }
    }

    setBusy(false);
    if (hasError) {
      toast.error(`Import xong với ${totalImported} highlights, ${totalSkipped} skipped, có lỗi`);
    } else {
      toast.success(`Đã import ${totalImported} highlights (${totalSkipped} skipped duplicate)`);
    }
    onSuccess?.();
  }

  const allReady =
    items.length > 0 &&
    items.every((it) => (it.manualTarget ?? it.match?.book.id) !== undefined);
  const allDone = items.length > 0 && items.every((it) => it.status === 'done');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import notes
          </DialogTitle>
          <DialogDescription>
            {targetBook
              ? `Import notes vào "${targetBook.title}"`
              : 'Chọn file .json hoặc .zip export từ Library'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {items.length === 0 && !parsing && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 border-2 border-dashed border-border bg-muted/20 py-8 hover:border-primary hover:bg-primary/5"
            >
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-foreground">Chọn file .json hoặc .zip</span>
              <span className="text-xs text-muted-foreground">
                Match by book_id trước, fallback theo title
              </span>
            </button>
          )}

          {parsing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang parse file...
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {items.length > 0 && (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {items.map((it, i) => (
                <ImportRow
                  key={`${it.pack.book.id}-${i}`}
                  item={it}
                  books={books}
                  onSetManual={(bookId) => setManualTarget(i, bookId)}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {allDone ? 'Đóng' : 'Huỷ'}
          </Button>
          {items.length > 0 && !allDone && (
            <Button
              onClick={runImport}
              disabled={!allReady || busy}
              className="gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Đang import...' : `Import ${items.length} pack`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportRow({
  item,
  books,
  onSetManual,
}: {
  item: PackWithMatch;
  books: Array<Pick<Book, 'id' | 'title' | 'author'>>;
  onSetManual: (bookId: string) => void;
}) {
  const targetBookId = item.manualTarget ?? item.match?.book.id ?? '';
  const targetBook = books.find((b) => b.id === targetBookId);

  return (
    <div className="space-y-1 border border-border bg-muted/20 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{item.pack.book.title}</span>
        <span className="text-muted-foreground">
          {item.pack.highlights.length} highlights
          {item.pack.progress && ' + progress'}
        </span>
      </div>

      {item.status === 'pending' && (
        <>
          {item.match ? (
            <p className="text-muted-foreground">
              [match] {item.match.book.title}{' '}
              <span className="text-muted-foreground/60">({item.match.strategy})</span>
            </p>
          ) : !targetBook ? (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
              <select
                value=""
                onChange={(e) => onSetManual(e.target.value)}
                className="flex-1 border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="" disabled>
                  Chọn sách đích...
                </option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-muted-foreground">[target] {targetBook.title}</p>
          )}
        </>
      )}

      {item.status === 'importing' && (
        <p className="flex items-center gap-1 text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          Đang import...
        </p>
      )}
      {item.status === 'done' && (
        <p className="text-success">
          [done] imported={item.imported}, skipped={item.skipped}
        </p>
      )}
      {item.status === 'error' && (
        <p className="text-destructive">[fail] {item.message}</p>
      )}
    </div>
  );
}