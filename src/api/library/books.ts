import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, BUCKET } from '@/lib/library/supabase';
import type { Book } from '@/lib/library/types';
import { isPdfFile, parseFileMeta } from '@/lib/library/file-meta';
import { uploadWithProgress } from '@/lib/library/upload-with-progress';
import { deleteCached, STORE_COVERS, STORE_FILES } from '@/lib/library/blob-cache';
import { compressPdf } from '@/lib/library/pdf-compress';
import { uploadToDrive } from '@/lib/library/drive-backup';
import type { CompressConfigValue, DriveBackupConfigValue } from '@/api/settingsApi';
import { authClient } from '@/lib/authClient';
import { useAuthStore } from '@/stores/authStore';

export type UploadStage =
  | 'pending'
  | 'compressing'
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
  /** Sau compress xong, hiển thị "45MB → 12MB (73%)" trong panel */
  compressSummary?: string;
  /** True khi backend chưa có `compress_config` — UI hiện toast info 1 lần */
  noConfig?: boolean;
}

export interface UploadVars {
  file: File;
  /** Skip compress step, upload raw (dùng khi file đã nén ngoài) */
  skipCompress?: boolean;
  onProgress?: (p: UploadProgress) => void;
}

/**
 * Ngưỡng size: file dưới ngưỡng skip compress (không đáng tốn quota).
 * File vượt ngưỡng trên skip vì Cloud Run request body limit 32 MB.
 */
const COMPRESS_MIN_BYTES = 2 * 1024 * 1024;   // 2 MB
const COMPRESS_MAX_BYTES = 30 * 1024 * 1024;  // 30 MB (Phase 1 limit)

async function loadCompressConfig(): Promise<CompressConfigValue | null> {
  // Try service registry first
  try {
    const { data: bindings } = await authClient
      .from('tool_service_bindings')
      .select('profile_id, overrides_json')
      .eq('tool_code', 'library')
      .eq('capability', 'pdf.compress')
      .eq('enabled', true)
      .order('priority')
      .limit(1);

    if (bindings?.length && bindings[0].profile_id) {
      const { data: credentials } = await authClient
        .from('service_credentials')
        .select('secret_data_json')
        .eq('profile_id', bindings[0].profile_id)
        .eq('status', 'active')
        .order('priority');

      if (credentials?.length) {
        const keys: { public_key: string; secret_key?: string }[] = [];
        for (const c of credentials) {
          const s = c.secret_data_json as { public_key?: string; secret_key?: string } | null;
          if (s?.public_key) {
            keys.push({ public_key: s.public_key, secret_key: s.secret_key });
          }
        }

        if (keys.length > 0) {
          const overrides = bindings[0].overrides_json as { compressionLevel?: string } | null;
          return {
            keys,
            compression_level: (overrides?.compressionLevel as CompressConfigValue['compression_level']) ?? 'recommended',
          };
        }
      }
    }
  } catch {
    // Fall through to legacy
  }

  // Legacy fallback
  const { data, error } = await authClient
    .from('app_settings')
    .select('value')
    .eq('key', 'compress_config')
    .maybeSingle();
  if (error) return null;
  if (!data || !data.value) return null;
  const v = data.value as Partial<CompressConfigValue>;
  const keys = Array.isArray(v.keys)
    ? v.keys.filter((k) => k && typeof k.public_key === 'string' && k.public_key.trim().length > 0)
    : [];
  if (keys.length === 0) return null;
  return {
    keys,
    compression_level: v.compression_level ?? 'recommended',
  };
}

async function loadDriveBackupConfig(): Promise<DriveBackupConfigValue | null> {
  // Try service registry first
  try {
    const { data: bindings } = await authClient
      .from('tool_service_bindings')
      .select('profile_id')
      .eq('tool_code', 'library')
      .eq('capability', 'storage.backup')
      .eq('enabled', true)
      .order('priority')
      .limit(1);

    if (bindings?.length && bindings[0].profile_id) {
      const { data: credentials } = await authClient
        .from('service_credentials')
        .select('secret_data_json')
        .eq('profile_id', bindings[0].profile_id)
        .eq('status', 'active')
        .order('priority')
        .limit(1);

      if (credentials?.length) {
        const s = credentials[0].secret_data_json as {
          client_id?: string;
          client_secret?: string;
          refresh_token?: string;
          folder_id?: string;
        } | null;
        if (s?.client_id && s?.client_secret && s?.refresh_token && s?.folder_id) {
          return {
            client_id: s.client_id,
            client_secret: s.client_secret,
            refresh_token: s.refresh_token,
            folder_id: s.folder_id,
          };
        }
      }
    }
  } catch {
    // Fall through to legacy
  }

  // Legacy fallback
  const { data, error } = await authClient
    .from('app_settings')
    .select('value')
    .eq('key', 'drive_backup_config')
    .maybeSingle();
  if (error) return null;
  if (!data || !data.value) return null;
  const v = data.value as Partial<DriveBackupConfigValue>;
  if (!v.client_id || !v.client_secret || !v.refresh_token || !v.folder_id) return null;
  return v as DriveBackupConfigValue;
}

/** Fire-and-forget Drive backup. Never throws. */
function fireDriveBackup(file: File, title: string): void {
  loadDriveBackupConfig().then((config) => {
    if (!config) {
      // eslint-disable-next-line no-console
      console.info('[drive-backup] Drive backup not configured, skipping');
      return;
    }
    uploadToDrive(file, title, config).catch(() => {
      // uploadToDrive already logs internally
    });
  }).catch(() => {
    // loadDriveBackupConfig network error — silent
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Loại bỏ suffix "_compressed" hoặc "-compressed" (case-insensitive) khỏi
 * filename trước extension. iLovePDF hoặc smallpdf hay thêm suffix này.
 * VD: "book_compressed.pdf" → "book.pdf".
 */
function stripCompressedSuffix(name: string): string {
  return name.replace(/[_-]compressed(?=\.[^.]+$)/i, '');
}

async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

/**
 * Username dùng cho `books.uploaded_by`. Lấy từ authStore (Project A).
 * Có thể NULL nếu profile chưa load — vẫn cho phép upload, backfill sau.
 */
function getCurrentUsername(): string | null {
  return useAuthStore.getState().profile?.username ?? null;
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
    // Empty snapshot = useless, force fresh fetch
    if (s.data.length === 0) return undefined;
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
    placeholderData: readSnapshot, // hiện tạm từ localStorage, luôn refetch fresh
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

/**
 * Shared flow cho useUploadBook + useReplaceBookFile:
 *   Stage 0: compress qua iLovePDF (nếu đủ điều kiện size + có config).
 *   Stage 1: extract cover từ trang 1 (best effort, không throw).
 *   Stage 2: upload PDF lên Storage với path mới.
 *   Stage 3: upload cover lên Storage (best effort).
 *
 * Caller lo DB step (INSERT cho upload, UPDATE cho replace) + cleanup file
 * cũ (chỉ replace). Return path mới để caller INSERT/UPDATE.
 */
interface PreparedUpload {
  finalFile: File;
  finalPath: string;
  coverPath: string | null;
  compressSummary?: string;
  /** Size của file cuối cùng (sau compress nếu có) để lưu DB. */
  fileSize: number;
}

async function prepareAndUploadBook(
  originalFile: File,
  skipCompress: boolean | undefined,
  logPrefix: string,
  report: (p: UploadProgress) => void,
): Promise<PreparedUpload> {
  if (!isPdfFile(originalFile)) throw new Error('Only PDF files are supported');

  // Stage 0: compress
  let file = originalFile;
  let compressSummary: string | undefined;

  const shouldCompress =
    !skipCompress &&
    file.size >= COMPRESS_MIN_BYTES &&
    file.size <= COMPRESS_MAX_BYTES;

  if (shouldCompress) {
    const config = await loadCompressConfig();
    if (!config) {
      // Admin chưa setup → skip + flag báo UI
      report({ stage: 'pending', percent: 0, noConfig: true });
    } else {
      report({ stage: 'compressing', percent: 20, message: 'Đang nén (1/5) Xác thực' });
      const result = await compressPdf(file, config, {
        onStageChange: (subStage) => {
          // Map 5-step iLovePDF flow → label thân thiện + bar 20%/step.
          // "upload/download" ở đây là app ↔ iLovePDF server, không phải
          // Supabase (Supabase upload ở stage `uploading-file` sau đó).
          const stepMap: Record<typeof subStage, { idx: number; label: string }> = {
            auth: { idx: 1, label: 'Xác thực' },
            start: { idx: 2, label: 'Khởi tạo' },
            upload: { idx: 3, label: 'Gửi file để nén' },
            process: { idx: 4, label: 'Đang nén trên server' },
            download: { idx: 5, label: 'Tải bản nén về' },
          };
          const s = stepMap[subStage];
          report({
            stage: 'compressing',
            percent: s.idx * 20,
            message: `Đang nén (${s.idx}/5) ${s.label}`,
          });
        },
      });
      // Chỉ dùng bản nén nếu thực sự nhỏ hơn. Giữ tên gốc (không suffix "_compressed").
      if (result.compressedSize < result.originalSize) {
        file = new File([result.blob], stripCompressedSuffix(originalFile.name), {
          type: 'application/pdf',
        });
        const savedPct = Math.round((1 - result.ratio) * 100);
        compressSummary = `Nén: ${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)} (${savedPct}%)`;
        // eslint-disable-next-line no-console
        console.info(`[${logPrefix}] ${compressSummary}`);
      } else {
        // eslint-disable-next-line no-console
        console.info(
          `[${logPrefix}] Compressed size >= original, dùng bản gốc: ${formatBytes(result.originalSize)}`,
        );
      }
    }
  }

  const safeName = sanitizeFilename(file.name);
  // Flat structure — sách shared, không nằm dưới folder user riêng.
  const finalPath = `${Date.now()}_${safeName}`;

  // Stage 1: extract cover trang 1 (best effort)
  report({ stage: 'extracting-cover', percent: 6, compressSummary });
  let cover: { blob: Blob; ext: 'png' } | null = null;
  try {
    // Lazy import — pdfjs chỉ tải khi user thực sự upload.
    const { extractPdfCover } = await import('@/lib/library/cover-extract');
    cover = await extractPdfCover(file);
  } catch (e) {
    console.warn(`[${logPrefix}] cover extract failed:`, e);
  }

  // Stage 2: upload PDF (8..85%)
  report({ stage: 'uploading-file', percent: 8, compressSummary });
  try {
    await uploadWithProgress(finalPath, file, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: true,
      onProgress: ({ percent }) => {
        report({
          stage: 'uploading-file',
          percent: 8 + Math.round(percent * 0.77),
          compressSummary,
        });
      },
    });
  } catch (err) {
    report({
      stage: 'error',
      percent: 0,
      message: err instanceof Error ? err.message : 'Upload failed',
      compressSummary,
    });
    throw err;
  }

  // Stage 3: upload cover (85..95%, best effort)
  let coverPath: string | null = null;
  if (cover) {
    report({ stage: 'uploading-cover', percent: 88, compressSummary });
    try {
      const cPath = `covers/${Date.now()}_${safeName}.${cover.ext}`;
      await uploadWithProgress(cPath, cover.blob, {
        contentType: 'image/png',
        cacheControl: '604800',
        upsert: true,
        onProgress: ({ percent }) => {
          report({
            stage: 'uploading-cover',
            percent: 88 + Math.round(percent * 0.07),
            compressSummary,
          });
        },
      });
      coverPath = cPath;
    } catch (e) {
      console.warn(`[${logPrefix}] cover upload failed:`, e);
    }
  }

  return { finalFile: file, finalPath, coverPath, compressSummary, fileSize: file.size };
}

export function useUploadBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file: originalFile, skipCompress, onProgress }: UploadVars) => {
      const report = (p: UploadProgress) => onProgress?.(p);

      // Fire-and-forget: upload bản gốc lên Google Drive (không await, không block)
      const title = originalFile.name.replace(/\.pdf$/i, '');
      fireDriveBackup(originalFile, title);

      const { finalFile, finalPath, coverPath, compressSummary, fileSize } =
        await prepareAndUploadBook(originalFile, skipCompress, 'upload', report);

      const userId = await getUserId();
      const username = getCurrentUsername();
      const meta = parseFileMeta(finalFile);

      // Stage 4: insert DB row (95..100%)
      report({ stage: 'saving', percent: 96, compressSummary });
      const { data, error } = await supabase
        .from('books')
        .insert({
          uploaded_by_id: userId,
          uploaded_by: username,
          title: meta.title,
          author: meta.author,
          cover_url: coverPath,
          file_url: finalPath,
          file_path: finalPath,
          format: 'pdf',
          file_size_bytes: fileSize,
        })
        .select()
        .single();
      if (error) {
        // Rollback: xoá file mới upload dở, tránh rác Storage.
        await supabase.storage.from(BUCKET).remove([finalPath]);
        if (coverPath) await supabase.storage.from(BUCKET).remove([coverPath]);
        report({
          stage: 'error',
          percent: 0,
          message: error.message,
          compressSummary,
        });
        throw error;
      }

      report({ stage: 'done', percent: 100, compressSummary });
      // Optimistic invalidate snapshot — onSuccess refetch sẽ ghi lại
      try { localStorage.removeItem(SNAPSHOT_KEY); } catch {}
      return data as Book;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reader', 'books'] });
      qc.invalidateQueries({ queryKey: ['reader', 'storage-usage'] });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reader', 'books'] });
      qc.invalidateQueries({ queryKey: ['reader', 'storage-usage'] });
    },
  });
}

// ============================================================
// Replace book file — giữ book_id + highlights + progress
// ============================================================
//
// ReplaceProgress = alias UploadProgress vì flow trùng stage. Giữ export
// name riêng để caller có thể type-signal rõ ràng nếu muốn.

export type ReplaceProgress = UploadProgress;

export interface ReplaceVars {
  book: Book;
  newFile: File;
  /** Skip compress khi replace bằng file đã nén ngoài. */
  skipCompress?: boolean;
  onProgress?: (p: ReplaceProgress) => void;
}

export function useReplaceBookFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ book, newFile: originalFile, skipCompress, onProgress }: ReplaceVars) => {
      const report = (p: UploadProgress) => onProgress?.(p);

      // Fire-and-forget: upload bản gốc lên Google Drive (không await, không block)
      const replaceTitle = originalFile.name.replace(/\.pdf$/i, '');
      fireDriveBackup(originalFile, replaceTitle);

      const { finalPath, coverPath, compressSummary, fileSize } =
        await prepareAndUploadBook(originalFile, skipCompress, 'replace', report);

      // Stage 4: UPDATE books row → point path mới. KHÔNG xoá file cũ
      // trước UPDATE (nếu UPDATE fail mất luôn data). Chỉ xoá sau khi
      // UPDATE thành công.
      report({ stage: 'saving', percent: 96, compressSummary });
      const { data, error } = await supabase
        .from('books')
        .update({
          file_url: finalPath,
          file_path: finalPath,
          cover_url: coverPath ?? book.cover_url,
          file_size_bytes: fileSize,
        })
        .eq('id', book.id)
        .select()
        .single();

      if (error) {
        // Rollback: xoá file mới upload dở, giữ nguyên row + file cũ.
        await supabase.storage.from(BUCKET).remove([finalPath]);
        if (coverPath) await supabase.storage.from(BUCKET).remove([coverPath]);
        report({
          stage: 'error',
          percent: 0,
          message: `Update DB fail: ${error.message}`,
          compressSummary,
        });
        throw error;
      }

      // Stage 5: cleanup file cũ (best effort, không throw nếu fail).
      const oldPaths = [book.file_path];
      if (book.cover_url && coverPath && book.cover_url !== coverPath) {
        oldPaths.push(book.cover_url);
      }
      try {
        await supabase.storage.from(BUCKET).remove(oldPaths);
      } catch (e) {
        console.warn('[replace] cleanup old file failed (không critical):', e);
      }
      try {
        await deleteCached(STORE_FILES, book.file_path);
        if (book.cover_url) await deleteCached(STORE_COVERS, book.cover_url);
      } catch {
        // ignore
      }

      report({ stage: 'done', percent: 100, compressSummary });
      try { localStorage.removeItem(SNAPSHOT_KEY); } catch {}
      return data as Book;
    },
    onSuccess: (updatedBook) => {
      qc.invalidateQueries({ queryKey: ['reader', 'books'] });
      qc.invalidateQueries({ queryKey: ['reader', 'storage-usage'] });
      // Invalidate single-book query + book-stats để Reader/detail refetch file mới.
      // Path đã đổi → Reader phải reload document fresh, tránh pdfjs giữ ref cũ.
      qc.invalidateQueries({ queryKey: ['reader', 'books', updatedBook.id] });
      qc.invalidateQueries({ queryKey: ['reader', 'book-stats', updatedBook.id] });
    },
  });
}

// ============================================================
// Rename book title
// ============================================================

export function useRenameBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookId, newTitle }: { bookId: string; newTitle: string }) => {
      const trimmed = newTitle.trim();
      if (!trimmed) throw new Error('Title không được trống');
      const { error } = await supabase
        .from('books')
        .update({ title: trimmed })
        .eq('id', bookId);
      if (error) throw error;
      return { bookId, newTitle: trimmed };
    },
    onSuccess: ({ bookId, newTitle }) => {
      // Optimistic update cache để UI đổi ngay không chờ refetch.
      qc.setQueryData<Book[] | undefined>(['reader', 'books'], (old) => {
        if (!old) return old;
        return old.map((b) => (b.id === bookId ? { ...b, title: newTitle } : b));
      });
      try { localStorage.removeItem(SNAPSHOT_KEY); } catch {}
    },
  });
}

// ============================================================
// Increment view count — fire-and-forget khi Reader mount
// ============================================================

export function useIncrementViewCount() {
  return useMutation({
    mutationFn: async (bookId: string) => {
      // RPC-style increment: dùng raw SQL via .rpc nếu có, hoặc read-then-write.
      // Cách đơn giản: dùng Postgres expression qua Supabase JS client không
      // hỗ trợ `column + 1` trực tiếp. Workaround: gọi .rpc hoặc dùng raw
      // fetch. Nhưng Supabase JS v2 hỗ trợ: chỉ cần gọi từ DB function.
      // Approach nhẹ nhất: tạo RPC hoặc dùng `.select` trước rồi write.
      // Chọn approach: fetch current count, +1, update. Race condition chấp
      // nhận (view count không cần chính xác tuyệt đối).
      const { data, error: fetchErr } = await supabase
        .from('books')
        .select('view_count')
        .eq('id', bookId)
        .single();
      if (fetchErr || !data) return; // silent fail
      const current = (data as { view_count: number }).view_count ?? 0;
      await supabase
        .from('books')
        .update({ view_count: current + 1 })
        .eq('id', bookId);
    },
  });
}