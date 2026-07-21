// ============================================================
// Re-embed all — utility cho admin "Re-embed all" button
// ============================================================
//
// Scan toàn bộ notes (type ≠ 'secret') + tasks user hiện tại
// từ workspace Supabase, enqueue vào embed-queue theo batch.
//
// KHÔNG block UI — sử dụng existing embed-queue worker (concurrency + rate-limit
// đã handle trong embed-queue.ts). Hàm này chỉ scan + enqueue, không tự embed.
//
// Gọi từ Setting admin panel.
// ============================================================

import { workspaceSelect } from '@/lib/workspace/client';
import { enqueueEmbed } from './embed-queue';
import { buildNoteEmbedText, buildTaskEmbedText, buildTaskMetadata } from './build-text';
import type { NoteRow, TaskRow } from '@/lib/workspace/mappers';
import type { NoteType } from '@/schemas/note';
import { useRagStore } from '@/stores/ragStore';

export interface ReEmbedProgress {
  notesCount: number;
  tasksCount: number;
  totalQueued: number;
}

export interface ReEmbedOptions {
  onProgress?: (progress: ReEmbedProgress) => void;
  /** Delay ms between enqueue batches to avoid flooding queue (default 50ms). */
  batchDelay?: number;
}

/**
 * Scan workspace notes + tasks for current user, enqueue embed jobs.
 * Returns final counts.
 */
export async function reEmbedAll(options?: ReEmbedOptions): Promise<ReEmbedProgress> {
  const batchDelay = options?.batchDelay ?? 50;
  const enabledNoteTypes = useRagStore.getState().config.enabledNoteTypes;

  let notesCount = 0;
  let tasksCount = 0;
  let totalQueued = 0;

  const report = () => {
    options?.onProgress?.({ notesCount, tasksCount, totalQueued });
  };

  // ── Notes ── (proxy handles user_id filter server-side)
  const noteRows = await workspaceSelect<NoteRow>('notes', {
    order: { column: 'created_at', ascending: true },
  });

  for (const row of noteRows) {
    if (row.type === 'secret') continue;
    if (!enabledNoteTypes.includes(row.type as NoteType)) continue;

    const text = buildNoteEmbedText({ title: row.title, content: row.content });
    if (!text.trim()) continue;

    enqueueEmbed({
      entity_type: 'note',
      entity_id: row.id,
      text,
      metadata: { type: row.type, title: row.title, tags: row.tags ?? null },
    });
    notesCount++;
    totalQueued++;
  }

  report();
  await delay(batchDelay);

  // ── Tasks ──
  const embedTasks = useRagStore.getState().config.embedTasks;
  if (embedTasks) {
    const taskRows = await workspaceSelect<TaskRow>('tasks', {
      order: { column: 'created_at', ascending: true },
    });

    for (const row of taskRows) {
      const task = {
        id: row.id,
        title: row.title,
        type: 'task' as const,
        description: row.description ?? null,
        parentId: row.list_id ?? null,
        status: (row.status as 'pending' | 'completed') ?? 'pending',
        priority: (row.priority as 'normal' | 'high') ?? 'normal',
        dueDate: row.due_date ?? null,
        recurring: row.recurring ?? false,
        url1: row.url1 ?? null,
        url2: row.url2 ?? null,
        url3: row.url3 ?? null,
        completedDate: row.completed_date ?? null,
        createdAt: row.created_at ?? null,
        updatedAt: row.updated_at ?? null,
      };
      const text = buildTaskEmbedText(task);
      if (!text.trim()) continue;

      enqueueEmbed({
        entity_type: 'task',
        entity_id: row.id,
        text,
        metadata: buildTaskMetadata(task),
      });
      tasksCount++;
      totalQueued++;
    }

    report();
  }

  return { notesCount, tasksCount, totalQueued };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}