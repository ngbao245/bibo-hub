// ============================================================
// Build embed text — convert domain entity → text để Gemini embed
// ============================================================
//
// Nguyên tắc:
//   - Note: title + stripped content (prose dài, embedding tự hiểu)
//   - Task: metadata-rich text gồm status/priority/dueDate keywords
//     để vector search match được câu hỏi structured như "task pending"
//   - Highlight: text gốc + note user nếu có
//
// Format thống nhất: text plain, lines tách nhau bằng '\n'.
// Trim cuối, không trailing newline.
// ============================================================

import type { Note } from '@/schemas/note';
import type { Task } from '@/schemas/task';
import type { Highlight } from '@/lib/library/types';

import { stripHtml } from './chunk';

// ------------------------------------------------------------
// Note
// ------------------------------------------------------------

/**
 * Build embed text từ note.
 *
 * Format:
 *   <title>
 *
 *   <stripped content>
 */
export function buildNoteEmbedText(note: Pick<Note, 'title' | 'content'>): string {
  const title = (note.title ?? '').trim();
  const body = stripHtml(note.content ?? '');
  const parts: string[] = [];
  if (title) parts.push(title);
  if (body) parts.push(body);
  return parts.join('\n\n').trim();
}

// ------------------------------------------------------------
// Task
// ------------------------------------------------------------

/**
 * Build embed text giàu metadata cho task.
 *
 * Lý do "redundant keywords" (pending chưa hoàn thành đang làm):
 *   Embedding model học đồng nghĩa từ corpus, nhưng độ tự tin cao hơn
 *   khi text gốc chứa nhiều biến thể. User hỏi "task chưa xong" / "việc
 *   dang dở" / "todo" đều cosine cao với text "chưa hoàn thành đang làm".
 *   Cost: ~10 từ extra mỗi task, không đáng kể.
 */
export function buildTaskEmbedText(task: Task): string {
  const parts: string[] = [];

  parts.push(`Task: ${task.title || '(no title)'}`);

  const desc = (task.description ?? '').toString().trim();
  if (desc) parts.push(`Mô tả: ${desc}`);

  parts.push(
    `Trạng thái: ${
      task.status === 'pending'
        ? 'chưa hoàn thành đang làm pending todo'
        : 'đã hoàn thành xong completed done'
    }`,
  );

  parts.push(
    `Mức độ: ${
      task.priority === 'high'
        ? 'quan trọng cao gấp khẩn urgent important high'
        : 'bình thường normal'
    }`,
  );

  if (task.dueDate) {
    parts.push(`Hạn: ${formatDate(String(task.dueDate))}`);
  }

  return parts.join('\n').trim();
}

/**
 * Metadata structured kèm cho task embedding row.
 * Dùng cho filter_metadata trong RPC search.
 */
export function buildTaskMetadata(task: Task): Record<string, unknown> {
  return {
    title: task.title || '',
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    parentId: task.parentId ?? null,
  };
}

// ------------------------------------------------------------
// Highlight
// ------------------------------------------------------------

export function buildHighlightEmbedText(h: Pick<Highlight, 'text' | 'note'>): string {
  const text = (h.text ?? '').trim();
  const note = (h.note ?? '').trim();
  if (!text && !note) return '';
  if (!note) return text;
  return `${text}\n\nGhi chú: ${note}`;
}

export function buildHighlightMetadata(
  h: Pick<Highlight, 'book_id' | 'location' | 'color'>,
  bookTitle?: string,
): Record<string, unknown> {
  return {
    bookId: h.book_id,
    bookTitle: bookTitle ?? null,
    page: h.location?.page ?? null,
    color: h.color,
  };
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function formatDate(raw: string): string {
  // raw có thể là ISO string hoặc số. Output ngắn dạng YYYY-MM-DD.
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toISOString().slice(0, 10);
  } catch {
    return raw;
  }
}