import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBookStats } from '@/tools/library/api/book-stats';
import type { Book } from '@/tools/library/lib/types';

interface Props {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (book: Book) => void;
  isDeleting?: boolean;
}

export default function DeleteConfirmDialog({
  book,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: Props) {
  const stats = useBookStats(book?.id, open && !!book);

  if (!book) return null;

  const hasNotes = (stats.data?.myHighlightsCount ?? 0) > 0 || stats.data?.myProgress !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Xoá sách
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{book.title}</span>
            {book.author && <span className="ml-1 text-muted-foreground">— {book.author}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {stats.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang đếm dữ liệu liên quan...
            </div>
          ) : stats.isError ? (
            <p className="text-destructive">
              Không load được stats. Cứ xoá nếu bạn chắc chắn.
            </p>
          ) : hasNotes ? (
            <div className="border border-destructive/40 bg-destructive/10 p-3 text-destructive">
              <p className="font-medium">Sách này sẽ bị xoá cùng dữ liệu ghi chú của bạn:</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                <li>{stats.data?.myHighlightsCount ?? 0} highlights của bạn</li>
                {stats.data?.myProgress && (
                  <li>
                    Reading progress: trang {stats.data.myProgress.page ?? '?'} ·{' '}
                    {stats.data.myProgress.percent}%
                  </li>
                )}
              </ul>
              <p className="mt-2 text-xs">
                Muốn giữ note? Click <strong>Xuất ghi chú</strong> trước, rồi Nhập lại sau khi upload sách mới.
              </p>
              <p className="mt-1 text-xs text-destructive/80">
                [!] Sách shared — highlights của user khác cũng sẽ mất theo (không hiển thị ở đây do RLS).
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Bạn chưa có highlight/progress trên sách này.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            File PDF + cover sẽ bị xoá khỏi Storage. Thao tác không thể undo.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Huỷ
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(book)}
            disabled={isDeleting}
            className="gap-2"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDeleting ? 'Đang xoá...' : 'Xoá vĩnh viễn'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}