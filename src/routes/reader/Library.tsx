import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, LogOut, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { useBooks, useDeleteBook, useUploadBook, type UploadProgress } from '@/api/reader/books';
import { useAllProgress } from '@/api/reader/progress';
import { signOut, useAuth } from '@/lib/reader/auth';
import type { Book, ReadingProgress } from '@/lib/reader/types';
import BookCover from '@/components/reader/BookCover';
import UploadProgressPanel, { type UploadItem } from '@/components/reader/UploadProgressPanel';

export default function ReaderLibrary() {
  const { user } = useAuth();
  const booksQuery = useBooks();
  const progressQuery = useAllProgress();
  const upload = useUploadBook();
  const del = useDeleteBook();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);

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

    const items: UploadItem[] = accepted.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      filename: file.name,
      progress: { stage: 'pending', percent: 0 },
    }));
    setUploads((prev) => [...prev, ...items]);

    for (let i = 0; i < accepted.length; i++) {
      const file = accepted[i];
      const item = items[i];
      try {
        await upload.mutateAsync({
          file,
          onProgress: (p) => patchUpload(item.id, p),
        });
        patchUpload(item.id, { stage: 'done', percent: 100 });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        patchUpload(item.id, { stage: 'error', percent: 0, message });
        toast.error(`Failed: ${file.name} — ${message}`);
      }
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

  async function performDelete(book: Book) {
    if (!window.confirm(`Delete book "${book.title}" and all its highlights? Cannot be undone.`)) return;
    try {
      await del.mutateAsync(book);
      toast.success('Deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
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
            <h1 className="text-base font-semibold">Reader</h1>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{user?.email}</span>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1 hover:text-zinc-200"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
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
                onDelete={() => performDelete(book)}
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
    </div>
  );
}

function isActiveStage(stage: UploadProgress['stage']): boolean {
  return stage !== 'done' && stage !== 'error' && stage !== 'pending';
}

function BookCard({
  book,
  progress,
  onDelete,
}: {
  book: Book;
  progress: ReadingProgress | null;
  onDelete: () => void;
}) {
  const percent = progress ? Math.round(progress.progress * 100) : 0;
  const page = progress?.location ? Number(progress.location) : null;
  const hasProgress = percent > 0;

  return (
    <div className="group relative">
      <Link
        to={`/reader/read/${book.id}`}
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

        {/* Progress bar mỏng dưới đáy cover */}
        {hasProgress && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </Link>

      <button
        onClick={onDelete}
        className="absolute right-1 top-1 hidden bg-zinc-900/80 p-1 text-zinc-400 hover:text-red-400 group-hover:block"
        title="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      <p className="mt-1.5 line-clamp-2 text-[11px] text-zinc-400" title={book.title}>
        {book.title}
      </p>
      {hasProgress ? (
        <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
          Trang {page ?? '?'} · {percent}%
        </p>
      ) : (
        <p className="mt-0.5 text-[10px] text-zinc-600">Chưa đọc</p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-zinc-800 py-20 text-center">
      <Upload className="mb-3 h-8 w-8 text-zinc-600" />
      <p className="text-sm text-zinc-400">Drop PDF files here, or click Upload</p>
      <p className="mt-1 text-xs text-zinc-600">Your library is private to your account</p>
    </div>
  );
}