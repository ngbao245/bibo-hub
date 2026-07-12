// ============================================================
// Dual-write helpers — gọi từ onSuccess của TanStack mutations
// ============================================================
//
// Mục tiêu: giảm boilerplate khi hook embed vào mutation hiện có.
// Tất cả helpers đều safe-fail (no throw) — không phá flow note save
// nếu RAG đang gặp lỗi.
//
// Filter cứng (KHÔNG dựa flag config):
//   - Note type='secret' luôn bị loại trừ.
//
// Filter mềm (dựa config trong ragStore):
//   - Note types khác trong enabledNoteTypes.
//   - embedTasks / embedHighlights.
// ============================================================

import type { Note } from '@/schemas/note';
import type { Task } from '@/schemas/task';
import type { Highlight } from '@/lib/library/types';

import { useRagStore } from '@/stores/ragStore';
import {
  enqueueEmbed,
  enqueueDelete,
  enqueueDeleteMany,
} from './embed-queue';
import {
  buildNoteEmbedText,
  buildTaskEmbedText,
  buildTaskMetadata,
  buildHighlightEmbedText,
  buildHighlightMetadata,
} from './build-text';

// ------------------------------------------------------------
// Note
// ------------------------------------------------------------

/** Có nên embed note này theo config + filter cứng. */
function shouldEmbedNote(note: Pick<Note, 'type'>): boolean {
  if (note.type === 'secret') return false;
  const enabled = useRagStore.getState().config.enabledNoteTypes;
  return enabled.includes(note.type);
}

/**
 * Dual-write note: enqueue embed (background).
 *
 * Gọi từ:
 *   - useCreateNote.onSuccess
 *   - useUpdateNote.onSuccess
 */
export function dualWriteNote(note: Pick<Note, 'id' | 'title' | 'content' | 'type' | 'tags'>): void {
  if (!note.id || note.id.startsWith('temp_')) return;
  if (!shouldEmbedNote(note)) {
    // Note vừa đổi type sang loại không index → xóa embedding cũ
    enqueueDelete('note', note.id);
    return;
  }

  const text = buildNoteEmbedText(note);
  enqueueEmbed({
    entity_type: 'note',
    entity_id: note.id,
    text,
    metadata: {
      type: note.type,
      title: note.title,
      tags: note.tags ?? null,
    },
  });
}

/** Xóa embedding của note (cascade từ useDeleteNote). */
export function dualDeleteNote(id: string): void {
  if (!id || id.startsWith('temp_')) return;
  enqueueDelete('note', id);
}

/** Xóa nhiều note cùng lúc (cascade child notes). */
export function dualDeleteNotes(ids: string[]): void {
  const valid = ids.filter((id) => id && !id.startsWith('temp_'));
  enqueueDeleteMany('note', valid);
}

// ------------------------------------------------------------
// Task
// ------------------------------------------------------------

export function dualWriteTask(task: Task): void {
  if (!task.id || task.id.startsWith('temp_')) return;
  if (!useRagStore.getState().config.embedTasks) {
    enqueueDelete('task', task.id);
    return;
  }

  const text = buildTaskEmbedText(task);
  enqueueEmbed({
    entity_type: 'task',
    entity_id: task.id,
    text,
    metadata: buildTaskMetadata(task),
  });
}

export function dualDeleteTask(id: string): void {
  if (!id || id.startsWith('temp_')) return;
  enqueueDelete('task', id);
}

// ------------------------------------------------------------
// Highlight
// ------------------------------------------------------------

export function dualWriteHighlight(
  h: Pick<Highlight, 'id' | 'book_id' | 'location' | 'text' | 'note' | 'color'>,
  bookTitle?: string,
): void {
  if (!h.id || h.id.startsWith('temp_')) return;
  if (!useRagStore.getState().config.embedHighlights) {
    enqueueDelete('highlight', h.id);
    return;
  }

  const text = buildHighlightEmbedText(h);
  enqueueEmbed({
    entity_type: 'highlight',
    entity_id: h.id,
    text,
    metadata: buildHighlightMetadata(h, bookTitle),
  });
}

export function dualDeleteHighlight(id: string): void {
  if (!id || id.startsWith('temp_')) return;
  enqueueDelete('highlight', id);
}