// ============================================================
// Chunk & text helpers cho RAG
// ============================================================
//
// - stripHtml: bỏ tag, decode entity, normalize whitespace.
// - chunkText: recursive split — ưu tiên paragraph → câu → từ.
// - hashContent: sha256 hex (SubtleCrypto) — detect khi cần re-embed.
// - shouldEmbed: filter note "linh tinh" trước khi gọi API.
// ============================================================

import DOMPurify from 'dompurify';

import type { EntityType, RagMinLengthFilter } from './types';

// ------------------------------------------------------------
// HTML → plain text
// ------------------------------------------------------------

/**
 * Strip HTML tags, decode entities, normalize whitespace.
 *
 * Pattern:
 *   1. DOMPurify clean để khử script/style/comment.
 *   2. DOMParser parse → textContent.
 *   3. Collapse whitespace.
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  let cleaned: string;
  try {
    cleaned = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  } catch {
    // Fallback nếu DOMPurify lỗi (vd ở worker)
    cleaned = html.replace(/<[^>]*>/g, ' ');
  }

  let text: string;
  try {
    const doc = new DOMParser().parseFromString(cleaned, 'text/html');
    text = doc.body.textContent ?? '';
  } catch {
    text = cleaned;
  }

  return text.replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------------------
// Hash (sha256 hex)
// ------------------------------------------------------------

export async function hashContent(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// ------------------------------------------------------------
// shouldEmbed — filter content rác
// ------------------------------------------------------------

/** Filter cứng luôn áp dụng: rỗng hoặc không có chữ cái. */
function passesHardFilter(text: string): boolean {
  if (text.trim().length === 0) return false;
  if (!/[\p{L}]/u.test(text)) return false;
  return true;
}

/**
 * True nếu content đáng được embed cho entity type cụ thể.
 *
 * Hard filter (luôn apply): rỗng / không có chữ cái.
 * Soft filter (config): min length theo entity type.
 *
 * Filter min length chỉ apply với entity type có trong `filter.applyTo`.
 * Vd `applyTo=['note']` → task/highlight ngắn vẫn được embed.
 *
 * Nếu `filter.enabled=false` → skip soft filter hoàn toàn.
 */
export function shouldEmbedForType(
  content: string,
  entityType: EntityType,
  filter: RagMinLengthFilter,
): boolean {
  const text = stripHtml(content);
  if (!passesHardFilter(text)) return false;

  if (!filter.enabled) return true;
  if (!filter.applyTo.includes(entityType)) return true;
  return text.length >= filter.minChars;
}

// ------------------------------------------------------------
// Chunking — recursive character split
// ------------------------------------------------------------

export interface ChunkOpts {
  /** Kích thước max của 1 chunk (ký tự). Default 1500 ~ 500 token. */
  size?: number;
  /** Overlap giữa 2 chunk liền kề. Default 150. */
  overlap?: number;
}

/**
 * Chia text thành các chunk có overlap, recursive theo separator priority.
 *
 * Priority: `\n\n` > `\n` > `. ` > ` ` > char.
 * Mỗi chunk tối đa `size` ký tự. Giữ overlap `overlap` ký tự với chunk trước
 * để giữ context xuyên ranh giới.
 *
 * Không strip HTML — caller phải tự stripHtml trước nếu cần.
 */
export function chunkText(text: string, opts: ChunkOpts = {}): string[] {
  const size = opts.size ?? 1500;
  const overlap = opts.overlap ?? 150;

  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= size) return [trimmed];

  const separators = ['\n\n', '\n', '. ', ' ', ''];
  return splitRecursive(trimmed, separators, size, overlap);
}

function splitRecursive(
  text: string,
  separators: string[],
  size: number,
  overlap: number,
): string[] {
  if (text.length <= size) return [text];

  const [sep, ...rest] = separators;
  // Nếu hết separator → chia theo character cứng
  if (sep === undefined) {
    return splitByCharCount(text, size, overlap);
  }

  // Tách theo separator hiện tại
  const parts = sep === '' ? splitByCharCount(text, size, overlap) : text.split(sep);

  const chunks: string[] = [];
  let buf = '';

  for (const part of parts) {
    const piece = sep === '' ? part : part + sep;
    const tentative = buf.length === 0 ? piece : buf + piece;

    if (tentative.length <= size) {
      buf = tentative;
      continue;
    }

    if (buf.length > 0) {
      chunks.push(buf.trim());
      // Carry over overlap
      buf = tailOverlap(buf, overlap) + piece;
    } else {
      // Part đơn lẻ vẫn quá to → recurse với separator mịn hơn
      const sub = splitRecursive(part, rest, size, overlap);
      chunks.push(...sub.slice(0, -1).map((s) => s.trim()));
      buf = sub[sub.length - 1] ?? '';
      if (sep !== '') buf += sep;
    }
  }

  if (buf.trim().length > 0) chunks.push(buf.trim());
  return chunks.filter((c) => c.length > 0);
}

function tailOverlap(text: string, overlap: number): string {
  if (overlap <= 0 || text.length <= overlap) return '';
  return text.slice(text.length - overlap);
}

function splitByCharCount(text: string, size: number, overlap: number): string[] {
  const out: string[] = [];
  const step = Math.max(1, size - overlap);
  for (let i = 0; i < text.length; i += step) {
    const slice = text.slice(i, i + size);
    if (slice.length === 0) break;
    out.push(slice);
    if (i + size >= text.length) break;
  }
  return out;
}