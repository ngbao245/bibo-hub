// ============================================================
// Library Note Pack — Export/Import highlights + progress
// ============================================================
//
// Schema versioning: nếu format đổi, bump NOTE_PACK_SCHEMA_VERSION và
// add migration trong validatePack. User cũ import file cũ vẫn work.
//
// Dùng RLS default: SELECT/INSERT chỉ row của user hiện tại. Không leak
// data user khác qua export.
// ============================================================

import JSZip from 'jszip';
import { supabase } from '@/lib/library/supabase';
import type { Book, Highlight, ReadingProgress } from '@/lib/library/types';

export const NOTE_PACK_SCHEMA_VERSION = 1;

export interface NotePackV1 {
  schema_version: 1;
  exported_at: string;
  book: {
    id: string;
    title: string;
    author: string | null;
  };
  highlights: Highlight[];
  progress: ReadingProgress | null;
}

export class NotePackError extends Error {
  code: 'invalid_json' | 'unknown_schema' | 'missing_field' | 'unsupported_version';
  constructor(code: NotePackError['code'], message: string) {
    super(message);
    this.name = 'NotePackError';
    this.code = code;
  }
}

// ============================================================
// Export
// ============================================================

async function fetchBookForExport(bookId: string): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, uploaded_by, uploaded_by_id, cover_url, file_url, file_path, format, created_at')
    .eq('id', bookId)
    .single();
  if (error) throw new Error(`Fetch book fail: ${error.message}`);
  return data as Book;
}

async function fetchHighlightsForExport(bookId: string): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Fetch highlights fail: ${error.message}`);
  return (data as Highlight[]) ?? [];
}

async function fetchProgressForExport(bookId: string): Promise<ReadingProgress | null> {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('book_id', bookId)
    .maybeSingle();
  if (error) throw new Error(`Fetch progress fail: ${error.message}`);
  return (data as ReadingProgress | null) ?? null;
}

/**
 * Sanitize filename cho download — bỏ dấu tiếng Việt + special char.
 * VD: "Rich Dad Poor Dad" → "rich-dad-poor-dad".
 */
function safeFilename(title: string): string {
  const stripped = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const noD = stripped.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  return noD
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'notes';
}

/**
 * Export note pack của 1 sách.
 * Return Blob JSON để caller tự trigger download.
 */
export async function exportBookNotes(
  bookId: string,
): Promise<{ blob: Blob; filename: string; hasNotes: boolean }> {
  const [book, highlights, progress] = await Promise.all([
    fetchBookForExport(bookId),
    fetchHighlightsForExport(bookId),
    fetchProgressForExport(bookId),
  ]);

  const pack: NotePackV1 = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
    },
    highlights,
    progress,
  };

  const json = JSON.stringify(pack, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `${safeFilename(book.title)}-notes.json`;
  const hasNotes = highlights.length > 0 || progress !== null;

  return { blob, filename, hasNotes };
}

/**
 * Export toàn bộ Library — ZIP chứa nhiều JSON note pack per book.
 * Chỉ include sách có highlights hoặc progress (skip sách trống để zip gọn).
 */
export async function exportAllNotes(): Promise<{ blob: Blob; filename: string; bookCount: number }> {
  // Lấy list books user thấy (RLS cho phép mọi authenticated đọc)
  const { data: books, error } = await supabase
    .from('books')
    .select('id, title')
    .order('title', { ascending: true });
  if (error) throw new Error(`Fetch books fail: ${error.message}`);

  const zip = new JSZip();
  let bookCount = 0;

  for (const b of (books ?? []) as Array<{ id: string; title: string }>) {
    try {
      const { blob, hasNotes } = await exportBookNotes(b.id);
      if (!hasNotes) continue; // skip sách trống
      const text = await blob.text();
      zip.file(`${safeFilename(b.title)}-notes.json`, text);
      bookCount++;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[note-pack] skip book ${b.id}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const now = new Date().toISOString().slice(0, 10);
  return {
    blob: zipBlob,
    filename: `library-notes-${now}.zip`,
    bookCount,
  };
}

// ============================================================
// Parse / Validate
// ============================================================

function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new NotePackError('missing_field', `${name} phải là object`);
  }
}

/** Validate + narrow type. Throw NotePackError nếu invalid. */
export function validatePack(raw: unknown): NotePackV1 {
  assertObject(raw, 'root');
  const version = raw.schema_version;
  if (typeof version !== 'number') {
    throw new NotePackError('missing_field', 'schema_version thiếu hoặc không phải number');
  }
  if (version !== NOTE_PACK_SCHEMA_VERSION) {
    throw new NotePackError(
      'unsupported_version',
      `Schema version ${version} không được hỗ trợ (expect ${NOTE_PACK_SCHEMA_VERSION})`,
    );
  }
  assertObject(raw.book, 'book');
  const book = raw.book;
  if (typeof book.id !== 'string' || typeof book.title !== 'string') {
    throw new NotePackError('missing_field', 'book.id hoặc book.title thiếu');
  }
  if (!Array.isArray(raw.highlights)) {
    throw new NotePackError('missing_field', 'highlights phải là array');
  }
  if (raw.progress !== null && typeof raw.progress !== 'object') {
    throw new NotePackError('missing_field', 'progress phải là object hoặc null');
  }

  return raw as unknown as NotePackV1;
}

/**
 * Parse file JSON hoặc ZIP thành array NotePackV1.
 * Return luôn array (single JSON → [pack], ZIP → nhiều pack).
 */
export async function parseNotePack(file: File): Promise<NotePackV1[]> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);
    const packs: NotePackV1[] = [];
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      if (!name.toLowerCase().endsWith('.json')) continue;
      const text = await entry.async('string');
      try {
        const raw = JSON.parse(text);
        packs.push(validatePack(raw));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[note-pack] skip zip entry ${name}: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }
    return packs;
  }

  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new NotePackError('invalid_json', 'File không phải JSON hợp lệ');
  }
  return [validatePack(raw)];
}

// ============================================================
// Match — book_id first, fuzzy title fallback
// ============================================================

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Simple Levenshtein — pure JS, không cần dep. */
export function simpleEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export interface BookMatchResult {
  book: Pick<Book, 'id' | 'title' | 'author'>;
  strategy: 'id' | 'title';
}

/**
 * Match pack vào 1 book. Ưu tiên book_id, fallback title fuzzy.
 * Return null nếu không match được (caller show list cho user chọn tay).
 */
export function matchBook(
  pack: NotePackV1,
  books: Array<Pick<Book, 'id' | 'title' | 'author'>>,
): BookMatchResult | null {
  // 1. book_id exact match
  const byId = books.find((b) => b.id === pack.book.id);
  if (byId) return { book: byId, strategy: 'id' };

  // 2. Title fuzzy match
  const packTitle = normalizeTitle(pack.book.title);
  const packAuthor = pack.book.author ? normalizeTitle(pack.book.author) : null;

  for (const b of books) {
    const bookTitle = normalizeTitle(b.title);
    const bookAuthor = b.author ? normalizeTitle(b.author) : null;
    if (bookTitle === packTitle) {
      // Author cùng khớp thì confident hơn (không require)
      if (!packAuthor || !bookAuthor || packAuthor === bookAuthor) {
        return { book: b, strategy: 'title' };
      }
    }
  }

  // 3. Edit distance < 3 nếu length gần bằng nhau
  for (const b of books) {
    const bookTitle = normalizeTitle(b.title);
    if (Math.abs(bookTitle.length - packTitle.length) > 3) continue;
    const dist = simpleEditDistance(bookTitle, packTitle);
    if (dist < 3) return { book: b, strategy: 'title' };
  }

  return null;
}

// ============================================================
// Import
// ============================================================

interface ImportResult {
  imported: number;
  skipped: number;
  progressUpdated: boolean;
}

function highlightDedupeKey(h: Highlight, targetBookId: string, userId: string): string {
  const page = h.location?.type === 'pdf' ? h.location.page : 0;
  const text = (h.text ?? '').trim().slice(0, 100);
  return `${targetBookId}|${userId}|${page}|${text}`;
}

/**
 * Import note pack vào 1 book đích. Rewrite book_id + user_id sang target.
 * Dedupe theo key (target_book_id, user_id, page, text-100).
 * Upsert progress theo composite (book_id, user_id).
 */
export async function importNotes(
  pack: NotePackV1,
  targetBookId: string,
): Promise<ImportResult> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');
  const userId = userData.user.id;

  // Query existing highlights của user cho target book → build Set dedupe
  const { data: existing, error: existingErr } = await supabase
    .from('highlights')
    .select('*')
    .eq('book_id', targetBookId)
    .eq('user_id', userId);
  if (existingErr) throw new Error(`Fetch existing highlights fail: ${existingErr.message}`);

  const existingKeys = new Set(
    ((existing as Highlight[]) ?? []).map((h) => highlightDedupeKey(h, targetBookId, userId)),
  );

  // Filter + rewrite highlights từ pack
  const toInsert: Array<Partial<Highlight>> = [];
  let skipped = 0;
  for (const h of pack.highlights) {
    // Rewrite ownership + target: user_id → current, book_id → target.
    // Bỏ id cũ (Postgres auto-gen uuid mới), giữ created_at gốc để
    // timeline export/import không lệch.
    const key = highlightDedupeKey(
      { ...h, book_id: targetBookId, user_id: userId } as Highlight,
      targetBookId,
      userId,
    );
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    toInsert.push({
      book_id: targetBookId,
      user_id: userId,
      location: h.location,
      cfi_range: h.cfi_range,
      text: h.text,
      note: h.note,
      color: h.color,
      created_at: h.created_at,
    });
    existingKeys.add(key);
  }

  // Batch insert highlights (Supabase limit ~1000 row / batch)
  let imported = 0;
  const BATCH = 500;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from('highlights').insert(batch);
    if (error) throw new Error(`Insert highlights fail: ${error.message}`);
    imported += batch.length;
  }

  // Upsert progress theo (book_id, user_id) — chỉ nếu pack có progress
  let progressUpdated = false;
  if (pack.progress) {
    const { error } = await supabase.from('reading_progress').upsert(
      {
        book_id: targetBookId,
        user_id: userId,
        location: pack.progress.location,
        progress: pack.progress.progress,
        updated_at: pack.progress.updated_at ?? new Date().toISOString(),
      },
      { onConflict: 'book_id,user_id' },
    );
    if (error) throw new Error(`Upsert progress fail: ${error.message}`);
    progressUpdated = true;
  }

  return { imported, skipped, progressUpdated };
}

// ============================================================
// Utility: trigger browser download
// ============================================================

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}