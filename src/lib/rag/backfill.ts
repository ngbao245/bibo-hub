// ============================================================
// Backfill — đồng bộ MockAPI/Supabase ↔ rag_embeddings
// ============================================================
//
// Strategy:
//   1. Fetch toàn bộ entity (note/task/highlight) từ source of truth.
//   2. Fetch danh sách content_hash hiện có trong rag_embeddings.
//   3. Diff:
//        - Có trong source, chưa có trong rag → enqueue embed
//        - Có trong source, hash khác → enqueue embed (re-embed)
//        - Có trong rag, không có trong source → enqueue delete (GC)
//   4. Hiển thị progress qua callback.
//
// Gọi từ BackfillButton (manual) hoặc lazy fixup tầng 1 (auto boot).
// ============================================================

import { fetchJson } from '@/api/client';
import { API } from '@/lib/config';
import { parseNotes, type Note } from '@/schemas/note';
import { parseTaskRecords, type Task } from '@/schemas/task';
import { supabase } from '@/lib/reader/supabase';
import type { Highlight } from '@/lib/reader/types';

import { useRagStore } from '@/stores/ragStore';
import {
  buildNoteEmbedText,
  buildTaskEmbedText,
  buildTaskMetadata,
  buildHighlightEmbedText,
  buildHighlightMetadata,
} from './build-text';
import { hashContent } from './chunk';
import { listEntityHashes } from './supabase-rag';
import { enqueueDelete, enqueueEmbed } from './embed-queue';

export interface BackfillProgress {
  phase: 'notes' | 'tasks' | 'highlights' | 'gc' | 'done';
  total: number;
  done: number;
  /** Số job đã enqueue (embed + delete). */
  enqueued: number;
}

export interface BackfillResult {
  notes: { scanned: number; enqueued: number; gced: number };
  tasks: { scanned: number; enqueued: number; gced: number };
  highlights: { scanned: number; enqueued: number; gced: number };
}

// ------------------------------------------------------------
// Entry point
// ------------------------------------------------------------

/**
 * Diff toàn bộ source ↔ rag_embeddings, enqueue jobs cần thiết.
 *
 * Trả về stats. Không đợi queue drain — caller có thể theo dõi qua
 * `subscribeQueue` nếu cần biết khi nào xong.
 */
export async function runBackfill(
  onProgress?: (p: BackfillProgress) => void,
): Promise<BackfillResult> {
  const config = useRagStore.getState().config;

  const result: BackfillResult = {
    notes: { scanned: 0, enqueued: 0, gced: 0 },
    tasks: { scanned: 0, enqueued: 0, gced: 0 },
    highlights: { scanned: 0, enqueued: 0, gced: 0 },
  };

  let totalEnqueued = 0;
  const emit = (phase: BackfillProgress['phase'], total: number, done: number) => {
    onProgress?.({ phase, total, done, enqueued: totalEnqueued });
  };

  // ----------------------------------------------------------
  // Notes
  // ----------------------------------------------------------
  emit('notes', 0, 0);
  const notes = await fetchAllNotes();
  const eligibleNotes = notes.filter((n) => isNoteEligible(n, config.enabledNoteTypes));
  result.notes.scanned = eligibleNotes.length;

  const noteHashes = await listEntityHashes('note');
  for (let i = 0; i < eligibleNotes.length; i++) {
    const n = eligibleNotes[i];
    const text = buildNoteEmbedText(n);
    if (!text) continue;
    const hash = await hashContent(text);
    if (noteHashes.get(n.id) !== hash) {
      enqueueEmbed({
        entity_type: 'note',
        entity_id: n.id,
        text,
        metadata: { type: n.type, title: n.title, tags: n.tags ?? null },
      });
      result.notes.enqueued++;
      totalEnqueued++;
    }
    if (i % 20 === 0) emit('notes', eligibleNotes.length, i);
  }
  emit('notes', eligibleNotes.length, eligibleNotes.length);

  // GC notes: row trong rag không còn entity hợp lệ
  // (đã xóa khỏi source HOẶC bị loại khỏi enabledNoteTypes / đổi sang type='secret')
  const validNoteIds = new Set(eligibleNotes.map((n) => n.id));
  const noteGc = Array.from(noteHashes.keys()).filter((id) => !validNoteIds.has(id));
  for (const id of noteGc) {
    enqueueDelete('note', id);
    result.notes.gced++;
    totalEnqueued++;
  }

  // ----------------------------------------------------------
  // Tasks
  // ----------------------------------------------------------
  emit('tasks', 0, 0);
  if (config.embedTasks) {
    const tasks = await fetchAllTasks();
    result.tasks.scanned = tasks.length;
    const taskHashes = await listEntityHashes('task');

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const text = buildTaskEmbedText(t);
      if (!text) continue;
      const hash = await hashContent(text);
      if (taskHashes.get(t.id) !== hash) {
        enqueueEmbed({
          entity_type: 'task',
          entity_id: t.id,
          text,
          metadata: buildTaskMetadata(t),
        });
        result.tasks.enqueued++;
        totalEnqueued++;
      }
      if (i % 20 === 0) emit('tasks', tasks.length, i);
    }
    emit('tasks', tasks.length, tasks.length);

    const validTaskIds = new Set(tasks.map((t) => t.id));
    const taskGc = Array.from(taskHashes.keys()).filter((id) => !validTaskIds.has(id));
    for (const id of taskGc) {
      enqueueDelete('task', id);
      result.tasks.gced++;
      totalEnqueued++;
    }
  } else {
    // Task indexing tắt → GC toàn bộ
    const taskHashes = await listEntityHashes('task');
    for (const id of taskHashes.keys()) {
      enqueueDelete('task', id);
      result.tasks.gced++;
      totalEnqueued++;
    }
  }

  // ----------------------------------------------------------
  // Highlights
  // ----------------------------------------------------------
  emit('highlights', 0, 0);
  if (config.embedHighlights) {
    const highlights = await fetchAllHighlights();
    result.highlights.scanned = highlights.length;
    const hlHashes = await listEntityHashes('highlight');

    for (let i = 0; i < highlights.length; i++) {
      const h = highlights[i];
      const text = buildHighlightEmbedText(h);
      if (!text) continue;
      const hash = await hashContent(text);
      if (hlHashes.get(h.id) !== hash) {
        enqueueEmbed({
          entity_type: 'highlight',
          entity_id: h.id,
          text,
          metadata: buildHighlightMetadata(h),
        });
        result.highlights.enqueued++;
        totalEnqueued++;
      }
      if (i % 20 === 0) emit('highlights', highlights.length, i);
    }
    emit('highlights', highlights.length, highlights.length);

    const validHlIds = new Set(highlights.map((h) => h.id));
    const hlGc = Array.from(hlHashes.keys()).filter((id) => !validHlIds.has(id));
    for (const id of hlGc) {
      enqueueDelete('highlight', id);
      result.highlights.gced++;
      totalEnqueued++;
    }
  } else {
    const hlHashes = await listEntityHashes('highlight');
    for (const id of hlHashes.keys()) {
      enqueueDelete('highlight', id);
      result.highlights.gced++;
      totalEnqueued++;
    }
  }

  emit('done', 0, 0);
  return result;
}

// ------------------------------------------------------------
// Filter helpers
// ------------------------------------------------------------

function isNoteEligible(note: Note, enabledTypes: Note['type'][]): boolean {
  if (note.type === 'secret') return false;
  return enabledTypes.includes(note.type);
}

// ------------------------------------------------------------
// Source fetchers
// ------------------------------------------------------------

async function fetchAllNotes(): Promise<Note[]> {
  const raw = await fetchJson<unknown[]>(API.NOTES);
  return parseNotes(raw);
}

async function fetchAllTasks(): Promise<Task[]> {
  const raw = await fetchJson<unknown[]>(API.TASKS);
  return parseTaskRecords(raw).tasks;
}

async function fetchAllHighlights(): Promise<Highlight[]> {
  // Supabase RLS đảm bảo chỉ trả về highlights của user hiện tại
  const { data, error } = await supabase
    .from('highlights')
    .select('*');
  if (error) throw new Error(`Fetch highlights failed: ${error.message}`);
  return (data ?? []) as Highlight[];
}

// ============================================================
// Lazy fixup — subset của backfill, silent + không GC
// ============================================================

export interface LazyFixupOpts {
  /** Chỉ xử lý N note gần nhất theo updatedAt DESC. Undefined = tất cả. */
  limit?: number;
  /**
   * Có GC orphan (Supabase có row nhưng MockAPI không còn note tương ứng).
   *
   * Chỉ nên bật khi `limit === undefined` (full scan). Vì nếu limit=10,
   * ta chỉ biết 10 note MockAPI mới nhất, không thể xác định note khác
   * có bị xóa hay chưa → false-positive GC.
   */
  gc?: boolean;
  /** Verbose console log. Default false. */
  verbose?: boolean;
}

export interface LazyFixupResult {
  scanned: number;
  enqueued: number;
  /** Số orphan (row Supabase không còn entity) đã enqueue delete. */
  gced: number;
  /** Info từng note bị enqueue embed — dùng cho console log debug. */
  enqueuedNotes: Array<{ id: string; title: string; reason: 'missing' | 'stale' }>;
  /** Info các orphan bị GC — dùng cho console log debug. */
  gcedIds: string[];
}

/**
 * Fixup embeddings cho notes bị miss (content_hash mismatch hoặc chưa có)
 * và (optional) GC orphan (row Supabase không còn entity trong MockAPI).
 *
 * KHÁC backfill:
 *   - Không xử lý tasks/highlights (chỉ note).
 *   - Chạy silent, không progress callback.
 *   - Chỉ enqueue embed/delete, không đợi drain.
 *
 * Dùng cho 2 tầng:
 *   - Tầng 1: App boot (limit undefined, gc=true → full scan + GC orphan).
 *   - Tầng 2: Mở RAG modal (limit=10, gc=false → chỉ check top 10 gần nhất).
 */
export async function runLazyFixupNotes(
  opts: LazyFixupOpts = {},
): Promise<LazyFixupResult> {
  const empty: LazyFixupResult = {
    scanned: 0,
    enqueued: 0,
    gced: 0,
    enqueuedNotes: [],
    gcedIds: [],
  };
  const status = useRagStore.getState().status;
  if (status !== 'ready') return empty;

  const config = useRagStore.getState().config;

  let notes: Note[];
  try {
    notes = await fetchAllNotes();
  } catch {
    return empty;
  }

  // Filter eligible + sort by updatedAt DESC (note mới nhất trước)
  const eligible = notes
    .filter((n) => isNoteEligible(n, config.enabledNoteTypes))
    .sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });

  const scoped = opts.limit !== undefined ? eligible.slice(0, opts.limit) : eligible;

  let hashes: Map<string, string>;
  try {
    hashes = await listEntityHashes('note');
  } catch {
    return { ...empty, scanned: scoped.length };
  }

  const enqueuedNotes: LazyFixupResult['enqueuedNotes'] = [];
  for (const n of scoped) {
    const text = buildNoteEmbedText(n);
    if (!text) continue;
    const hash = await hashContent(text);
    const existing = hashes.get(n.id);
    if (existing !== hash) {
      enqueueEmbed({
        entity_type: 'note',
        entity_id: n.id,
        text,
        metadata: { type: n.type, title: n.title, tags: n.tags ?? null },
      });
      enqueuedNotes.push({
        id: n.id,
        title: n.title || '(no title)',
        reason: existing === undefined ? 'missing' : 'stale',
      });
    }
  }

  // GC orphan — chỉ khi full scan (limit undefined) và bật gc.
  // Lý do: với limit=10, ta không biết note khác có bị xóa hay chưa
  // → cấm GC để tránh false-positive.
  const gcedIds: string[] = [];
  if (opts.gc && opts.limit === undefined) {
    // Set id note còn tồn tại trong MockAPI (kể cả note không eligible,
    // vd type='secret' — không embed nhưng cũng không phải orphan).
    const allValidIds = new Set(notes.map((n) => n.id));
    for (const id of hashes.keys()) {
      if (!allValidIds.has(id)) {
        enqueueDelete('note', id);
        gcedIds.push(id);
      }
    }
  }

  if (opts.verbose) {
    /* eslint-disable no-console */
    console.info(
      `[rag-fixup] scanned=${scoped.length}, enqueued=${enqueuedNotes.length}, gced=${gcedIds.length}, limit=${opts.limit ?? 'all'}, gc=${opts.gc ? 'on' : 'off'}`,
    );
    for (const n of enqueuedNotes) {
      console.info(`[rag-fixup]  · ${n.reason.padEnd(7)} "${n.title}" (id=${n.id})`);
    }
    for (const id of gcedIds) {
      console.info(`[rag-fixup]  · orphan  (id=${id}) → enqueue delete`);
    }
    /* eslint-enable no-console */
  }

  return {
    scanned: scoped.length,
    enqueued: enqueuedNotes.length,
    gced: gcedIds.length,
    enqueuedNotes,
    gcedIds,
  };
}