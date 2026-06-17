import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, BUCKET } from '@/lib/reader/supabase';
import type { Book } from '@/lib/reader/types';
import { isPdfFile, parseFileMeta } from '@/lib/reader/file-meta';
import { uploadWithProgress } from '@/lib/reader/upload-with-progress';
import { deleteCached, STORE_COVERS, STORE_FILES } from '@/lib/reader/blob-cache';

export type UploadStage =
  | 'pending'
  | 'extracting-cover'
  | 'uploading-file'
  | 'uploading-cover'
  | 'saving'
  | 'done'
  | 'error';

export interface UploadProgress {
  stage: UploadStage;
  /** 0..100 — tổng tiến độ ước lượng (file upload chiếm phần lớn) */
  percent: number;
  message?: string;
}

export interface UploadVars {
  file: File;
  onProgress?: (p: UploadProgress) => void;
}

async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

/**
 * Supabase Storage chỉ cho phép ASCII trong key. Bỏ dấu tiếng Việt,
 * thay khoảng trắng bằng `_`, drop ký tự không an toàn còn lại.
 */
function sanitizeFilename(name: string): string {
  // NFD tách dấu khỏi chữ cái → drop dấu
  const stripped = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Đặc biệt: đ/Đ không nằm trong combining marks
  const noD = stripped.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  // Còn lại: chỉ giữ a-z 0-9 . _ -, thay khoảng trắng → _
  return noD
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'file';
}

// =============================================================
// LocalStorage snapshot cho query cache.
// =============================================================
//
// Chỉ persist các query nhẹ (books list) — highlights/progress fetch
// theo bookId nên không persist được trực tiếp, query sẽ refetch khi
// người dùng mở book.
//
// TTL 1 ngày — sách cũ vẫn hiện ngay khi reload, không stale lâu.

const SNAPSHOT_KEY = 'reader_books_snapshot';
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

interface BooksSnapshot {
  data: Book[];
  saved_at: number;
}

function readSnapshot(): Book[] | undefined {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as BooksSnapshot;
    if (Date.now() - s.saved_at > SNAPSHOT_TTL_MS) return undefined;
    return s.data;
  } catch {
    return undefined;
  }
}

function writeSnapshot(data: Book[]) {
  try {
    const s: BooksSnapshot = { data, saved_at: Date.now() };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
  } catch {
    // quota exceeded → skip
  }
}

export function useBooks() {
  return useQuery({
    queryKey: ['reader', 'books'],
    initialData: readSnapshot, // hydrate ngay từ localStorage
    queryFn: async (): Promise<Book[]> => {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = data as Book[];
      writeSnapshot(list); // re-persist sau mỗi fetch fresh
      return list;
    },
  });
}

export function useBook(bookId: string | undefined) {
  return useQuery({
    queryKey: ['reader', 'books', bookId],
    enabled: !!bookId,
    queryFn: async (): Promise<Book> => {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();
      if (error) throw error;
      return data as Book;
    },
  });
}

/** Signed URL valid 1h, bucket is private. */
export async function getBookFileUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

/** Download file blob qua Supabase SDK — bypass CORS issues của signed URL. */
export async function downloadBookFile(filePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
  if (error) throw error;
  return data;
}

export function useUploadBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, onProgress }: UploadVars) => {
      const report = (p: UploadProgress) => onProgress?.(p);

      if (!isPdfFile(file)) throw new Error('Only PDF files are supported');

      const userId = await getUserId();
      const meta = parseFileMeta(file);
      const safeName = sanitizeFilename(file.name);
      const path = `${userId}/${Date.now()}_${safeName}`;

      // Stage 1: render trang 1 ra blob để làm cover
      report({ stage: 'extracting-cover', percent: 2 });
      let cover: { blob: Blob; ext: 'png' } | null = null;
      try {
        // Lazy import — pdfjs chỉ tải khi user thực sự upload, không vào
        // chunk Library lúc mới mở /reader.
        const { extractPdfCover } = await import('@/lib/reader/cover-extract');
        cover = await extractPdfCover(file);
      } catch (e) {
        console.warn('[reader] cover extract failed:', e);
      }

      // Stage 2: upload main file (chiếm 5..85% tổng)
      report({ stage: 'uploading-file', percent: 5 });
      try {
        await uploadWithProgress(path, file, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false,
          onProgress: ({ percent }) => {
            report({ stage: 'uploading-file', percent: 5 + Math.round(percent * 0.8) });
          },
        });
      } catch (err) {
        report({
          stage: 'error',
          percent: 0,
          message: err instanceof Error ? err.message : 'Upload failed',
        });
        throw err;
      }

      // Stage 3: upload cover (chiếm 85..95%)
      let coverPath: string | null = null;
      if (cover) {
        report({ stage: 'uploading-cover', percent: 88 });
        try {
          const cPath = `${userId}/covers/${Date.now()}_${safeName}.${cover.ext}`;
          await uploadWithProgress(cPath, cover.blob, {
            contentType: 'image/png',
            cacheControl: '604800',
            upsert: false,
            onProgress: ({ percent }) => {
              report({ stage: 'uploading-cover', percent: 88 + Math.round(percent * 0.07) });
            },
          });
          coverPath = cPath;
        } catch (e) {
          console.warn('[reader] cover upload failed:', e);
        }
      }

      // Stage 4: insert DB row (95..100%)
      report({ stage: 'saving', percent: 96 });
      const { data, error } = await supabase
        .from('books')
        .insert({
          user_id: userId,
          title: meta.title,
          author: meta.author,
          cover_url: coverPath,
          file_url: path,
          file_path: path,
          format: 'pdf',
        })
        .select()
        .single();
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        if (coverPath) await supabase.storage.from(BUCKET).remove([coverPath]);
        report({
          stage: 'error',
          percent: 0,
          message: error.message,
        });
        throw error;
      }

      report({ stage: 'done', percent: 100 });
      // Optimistic invalidate snapshot — onSuccess refetch sẽ ghi lại
      try { localStorage.removeItem(SNAPSHOT_KEY); } catch {}
      return data as Book;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reader', 'books'] }),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (book: Book) => {
      const paths = [book.file_path];
      if (book.cover_url) paths.push(book.cover_url);
      await supabase.storage.from(BUCKET).remove(paths);
      const { error } = await supabase.from('books').delete().eq('id', book.id);
      if (error) throw error;
      // Evict blob cache để khỏi giữ rác
      await deleteCached(STORE_FILES, book.file_path);
      if (book.cover_url) await deleteCached(STORE_COVERS, book.cover_url);
      try { localStorage.removeItem(SNAPSHOT_KEY); } catch {}
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reader', 'books'] }),
  });
}
