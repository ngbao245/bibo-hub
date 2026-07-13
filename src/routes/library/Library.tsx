import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Download, Eye, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';

import {
  useBooks,
  useDeleteBook,
  useRenameBook,
  useReplaceBookFile,
  useUploadBook,
  type UploadProgress,
} from '@/api/library/books';
import { useAllProgress } from '@/api/library/progress';
import { useReaderStorageUsage, isStorageWarn } from '@/api/library/usage';
import { CompressError } from '@/lib/library/pdf-compress';
import { downloadBlob, exportAllNotes, exportBookNotes } from '@/lib/library/note-pack';
import type { Book, ReadingProgress } from '@/lib/library/types';
import BookCover from '@/components/library/BookCover';
import StorageBadge from '@/components/library/StorageBadge';
import UploadProgressPanel, { type UploadItem } from '@/components/library/UploadProgressPanel';
import BookActionsMenu from '@/components/library/BookActionsMenu';
import DeleteConfirmDialog from '@/components/library/DeleteConfirmDialog';
import ReplaceBookDialog from '@/components/library/ReplaceBookDialog';
import ImportNotesDialog from '@/components/library/ImportNotesDialog';
import { useAuthStore } from '@/stores/authStore';
import { evictExpiredEntries } from '@/lib/library/blob-cache';

// Evict expired IndexedDB cache entries on library mount (fire-and-forget)
let evicted = false;
function runEvictOnce() {
  if (evicted) return;
  evicted = true;
  void evictExpiredEntries();
}

export default function ReaderLibrary() {
  runEvictOnce();
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = profile?.role === 'admin';
  const booksQuery = useBooks();
  const progressQuery = useAllProgress();
  const storageQuery = useReaderStorageUsage();
  const upload = useUploadBook();
  const replaceFile = useReplaceBookFile();
  const renameBook = useRenameBook();
  const del = useDeleteBook();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const noConfigToastedRef = useRef(false);
  const [renamingBookId, setRenamingBookId] = useState<string | null>(null);

  // Dialog state — chỉ 1 dialog mở cùng lúc
  const [deleteBook, setDeleteBook] = useState<Book | null>(null);
  const [replaceBook, setReplaceBook] = useState<Book | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<Book | null>(null);

  const booksForMatch = useMemo(
    () =>
      (booksQuery.data ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
      })),
    [booksQuery.data],
  );

  function patchUpload(id: string, progress: UploadProgress) {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress } : u)));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter((f) => /\.pdf$/i.test(f.name));
    if (accepted.length === 0) {
      toast.error('No PDF files found');
      return;
    }

    if (isStorageWarn(storageQuery.data)) {
      const percent = storageQuery.data
        ? Math.round((storageQuery.data.used / storageQuery.data.limit) * 100)
        : 0;
      toast.warning(`Library storage đã dùng ${percent}%. Nén PDF hoặc xoá sách cũ trước khi upload.`);
    }

    const items: UploadItem[] = accepted.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      filename: file.name,
      progress: { stage: 'pending', percent: 0 },
    }));
    setUploads((prev) => [...prev, ...items]);

    for (let i = 0; i < accepted.length; i++) {
      const file = accepted[i];
      const item = items[i];
      await runUpload(file, item.id, false);
    }
  }

  async function runUpload(file: File, itemId: string, skip: boolean) {
    try {
      await upload.mutateAsync({
        file,
        skipCompress: skip,
        onProgress: (p) => {
          if (p.noConfig && !noConfigToastedRef.current) {
            noConfigToastedRef.current = true;
            toast.info('Admin chưa setup PDF Compress service — upload nguyên bản.');
          }
          patchUpload(itemId, p);
        },
      });
      patchUpload(itemId, { stage: 'done', percent: 100 });
    } catch (err) {
      if (err instanceof CompressError) {
        const proceed = window.confirm(
          `Nén PDF fail (${err.code}): ${err.message}\n\nUpload bản gốc?`,
        );
        if (proceed) {
          await runUpload(file, itemId, true);
          return;
        }
        patchUpload(itemId, {
          stage: 'error',
          percent: 0,
          message: `Compress fail: ${err.message}`,
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'Upload failed';
      patchUpload(itemId, { stage: 'error', percent: 0, message });
      toast.error(`Failed: ${file.name} — ${message}`);
    }
  }

  function dismissUpload(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }

  function clearDoneUploads() {
    setUploads((prev) =>
      prev.filter((u) => u.progress.stage !== 'done' && u.progress.stage !== 'error'),
    );
  }

  // Book actions
  async function handleExport(book: Book) {
    try {
      const { blob, filename, hasNotes } = await exportBookNotes(book.id);
      downloadBlob(blob, filename);
      if (!hasNotes) toast.info('Sách chưa có note nào — file JSON export rỗng.');
      else toast.success(`Exported ${filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export fail');
    }
  }

  async function handleExportAll() {
    try {
      toast.info('Đang gom notes...');
      const { blob, filename, bookCount } = await exportAllNotes();
      if (bookCount === 0) {
        toast.warning('Không có sách nào có note để export.');
        return;
      }
      downloadBlob(blob, filename);
      toast.success(`Exported ${bookCount} sách vào ${filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export all fail');
    }
  }

  function handleImportForBook(book: Book) {
    setImportTarget(book);
    setImportOpen(true);
  }

  async function handleRenameSubmit(book: Book, newTitle: string) {
    try {
      await renameBook.mutateAsync({ bookId: book.id, newTitle });
      setRenamingBookId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename fail');
      setRenamingBookId(null);
    }
  }

  async function performDelete(book: Book) {
    try {
      await del.mutateAsync(book);
      toast.success('Deleted');
      setDeleteBook(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function performReplace(book: Book, newFile: File) {
    const item: UploadItem = {
      id: `replace_${book.id}_${Date.now()}`,
      filename: `[replace] ${newFile.name}`,
      progress: { stage: 'pending', percent: 0 },
    };
    setUploads((prev) => [...prev, item]);
    setReplaceBook(null);
    try {
      await replaceFile.mutateAsync({
        book,
        newFile,
        onProgress: (p) => patchUpload(item.id, p),
      });
      patchUpload(item.id, { stage: 'done', percent: 100 });
      toast.success(`Đã replace "${book.title}"`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Replace failed';
      patchUpload(item.id, { stage: 'error', percent: 0, message });
      toast.error(`Replace fail: ${message}`);
    }
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">Hub</span>
          </Link>
          <span className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-sky-400" />
            <h1 className="text-base font-semibold">Library</h1>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <StorageBadge />
          <span className="h-4 w-px bg-zinc-800" />
          <span>{profile?.username ?? ''}</span>
        </div>
      </header>

      <div
        className={`flex-1 overflow-auto p-6 ${dragOver ? 'bg-zinc-900/50' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-300">
            Library <span className="ml-2 text-zinc-600">{booksQuery.data?.length ?? 0}</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAll}
              className="flex items-center gap-1 border border-zinc-700 bg-transparent px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
              title="Xuất toàn bộ ghi chú (highlights + tiến độ đọc) thành file ZIP"
            >
              <Download className="h-3.5 w-3.5" />
              Xuất tất cả ghi chú
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploads.some((u) => isActiveStage(u.progress.stage))}
              className="flex items-center gap-1.5 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {uploads.some((u) => isActiveStage(u.progress.stage)) ? (
                <>
                  <Upload className="h-3.5 w-3.5 animate-pulse" />
                  Uploading…
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Upload PDF
                </>
              )}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {booksQuery.isLoading ? (
          <div className="text-sm text-zinc-500">Loading…</div>
        ) : booksQuery.error ? (
          <div className="text-sm text-red-400">
            {booksQuery.error instanceof Error ? booksQuery.error.message : 'Failed to load'}
          </div>
        ) : !booksQuery.data || booksQuery.data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {booksQuery.data.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                progress={progressQuery.data?.get(book.id) ?? null}
                canManage={isAdmin}
                canRename={isAdmin || book.uploaded_by_id === profile?.id}
                renamingBookId={renamingBookId}
                onRename={(b) => setRenamingBookId(b.id)}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={() => setRenamingBookId(null)}
                onExport={handleExport}
                onImport={handleImportForBook}
                onReplace={setReplaceBook}
                onDelete={setDeleteBook}
              />
            ))}
          </div>
        )}
      </div>

      <UploadProgressPanel
        items={uploads}
        onDismiss={dismissUpload}
        onClearDone={clearDoneUploads}
      />

      <DeleteConfirmDialog
        book={deleteBook}
        open={!!deleteBook}
        onOpenChange={(open) => !open && setDeleteBook(null)}
        onConfirm={performDelete}
        isDeleting={del.isPending}
      />

      <ReplaceBookDialog
        book={replaceBook}
        open={!!replaceBook}
        onOpenChange={(open) => !open && setReplaceBook(null)}
        onConfirm={performReplace}
        isReplacing={replaceFile.isPending}
      />

      <ImportNotesDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        books={booksForMatch}
        targetBook={importTarget}
        onSuccess={() => booksQuery.refetch()}
      />
    </div>
  );
}

function isActiveStage(stage: UploadProgress['stage']): boolean {
  return stage !== 'done' && stage !== 'error' && stage !== 'pending';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BookCard({
  book,
  progress,
  canManage,
  canRename,
  renamingBookId,
  onRename,
  onRenameSubmit,
  onRenameCancel,
  onExport,
  onImport,
  onReplace,
  onDelete,
}: {
  book: Book;
  progress: ReadingProgress | null;
  canManage: boolean;
  canRename: boolean;
  renamingBookId: string | null;
  onRename: (book: Book) => void;
  onRenameSubmit: (book: Book, newTitle: string) => void;
  onRenameCancel: () => void;
  onExport: (book: Book) => void;
  onImport: (book: Book) => void;
  onReplace: (book: Book) => void;
  onDelete: (book: Book) => void;
}) {
  const percent = progress ? Math.round(progress.progress * 100) : 0;
  const page = progress?.location ? Number(progress.location) : null;
  const hasProgress = percent > 0;
  const uploader = book.uploaded_by ?? 'system';
  const isRenaming = renamingBookId === book.id;

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // triggers onBlur → submit
    } else if (e.key === 'Escape') {
      onRenameCancel();
    }
  }

  function handleRenameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.currentTarget.value.trim();
    if (val && val !== book.title) {
      onRenameSubmit(book, val);
    } else {
      onRenameCancel();
    }
  }

  return (
    <div className="group relative">
      <Link
        to={`/library/read/${book.id}`}
        className="relative block aspect-[2/3] overflow-hidden border border-zinc-800 bg-zinc-900 transition-colors hover:border-sky-600"
      >
        {book.cover_url ? (
          <BookCover
            path={book.cover_url}
            alt={book.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="flex h-full flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3">
          <p className="line-clamp-3 text-xs font-medium text-zinc-100">{book.title}</p>
          {book.author && <p className="mt-1 text-[10px] text-zinc-300">{book.author}</p>}
        </div>

        {hasProgress && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        )}
      </Link>

      <div className="absolute right-1 top-1 opacity-60 transition-opacity group-hover:opacity-100">
        <BookActionsMenu
          book={book}
          canManage={canManage}
          canRename={canRename}
          onExport={onExport}
          onImport={onImport}
          onRename={onRename}
          onReplace={onReplace}
          onDelete={onDelete}
        />
      </div>

      {isRenaming ? (
        <input
          type="text"
          defaultValue={book.title}
          autoFocus
          onKeyDown={handleRenameKeyDown}
          onBlur={handleRenameBlur}
          className="mt-1.5 w-full border border-sky-600 bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-200 outline-none"
        />
      ) : (
        <div className="mt-1.5 flex items-start justify-between gap-1">
          <p className="line-clamp-2 text-[11px] text-zinc-400" title={book.title}>
            {book.title}
          </p>
          <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-zinc-500">
            {hasProgress ? `Trang ${page ?? '?'} · ${percent}%` : 'Chưa đọc'}
          </span>
        </div>
      )}
      <div className="mt-0.5 flex items-center justify-between text-[10px]">
        <p className="truncate text-zinc-500" title={`Uploaded by ${uploader}`}>
          {uploader}
        </p>
        <p className="flex shrink-0 items-center gap-1 text-zinc-600">
          {book.file_size_bytes != null && (
            <span className="font-mono">{formatFileSize(book.file_size_bytes)}</span>
          )}
          <span className="flex items-center gap-0.5">
            <Eye className="h-3 w-3" />
            {book.view_count}
          </span>
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-zinc-800 py-20 text-center">
      <Upload className="mb-3 h-8 w-8 text-zinc-600" />
      <p className="text-sm text-zinc-400">Drop PDF files here, or click Upload</p>
      <p className="mt-1 text-xs text-zinc-600">
        Sách bạn upload sẽ có trong thư viện chung cho mọi người
      </p>
    </div>
  );
}