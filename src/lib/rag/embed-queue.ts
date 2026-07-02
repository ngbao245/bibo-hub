// ============================================================
// Embed queue — background dual-write cho RAG
// ============================================================
//
// Khi user save note/task/highlight, mutation success → enqueue
// 1 job. Queue chạy background với concurrency 3, retry 3 lần
// exponential backoff. Hết retry → log warn, không block UI.
//
// Mọi job đều safe-fail:
//   - RAG status != 'ready' → silently drop (đã có ghi log boot)
//   - No Gemini key → throw → drop
//   - Network error → retry
//
// Persistence: in-memory only. Khi reload tab, queue mất.
// Lazy fixup (Phase 0 §8 plan) sẽ tự re-embed missing items.
// ============================================================

import { useRagStore } from '@/stores/ragStore';
import { embedTexts } from './gemini';
import { chunkText, hashContent, shouldEmbedForType } from './chunk';
import {
  upsertEmbeddingChunks,
  deleteEmbedding,
} from './supabase-rag';
import {
  RagAllKeysFailedError,
  RagNoTokenError,
  type EntityType,
} from './types';

// ------------------------------------------------------------
// Job types
// ------------------------------------------------------------

interface EmbedJob {
  kind: 'embed';
  entity_type: EntityType;
  entity_id: string;
  /** Text đã build sẵn (caller responsible cho stripHtml + buildTaskEmbedText etc.) */
  text: string;
  /** Metadata jsonb lưu kèm row. Default {}. */
  metadata?: Record<string, unknown>;
  /** Số retry đã thử. */
  attempts: number;
}

interface DeleteJob {
  kind: 'delete';
  entity_type: EntityType;
  entity_id: string;
  attempts: number;
}

type Job = EmbedJob | DeleteJob;

// ------------------------------------------------------------
// State
// ------------------------------------------------------------

const MAX_CONCURRENCY = 1;
const MAX_ATTEMPTS = 5;

/** Delay giữa 2 embed requests liên tiếp (ms) — tránh 429 RPM. */
const INTER_REQUEST_DELAY_MS = 4500; // 15 RPM = 1 request / 4s, dùng 4.5s an toàn

const queue: Job[] = [];
let running = 0;
let listenerSet: Set<(snapshot: QueueSnapshot) => void> = new Set();

export interface QueueSnapshot {
  pending: number;
  running: number;
}

function notify() {
  const snap: QueueSnapshot = { pending: queue.length, running };
  for (const fn of listenerSet) fn(snap);
}

export function subscribeQueue(fn: (snap: QueueSnapshot) => void): () => void {
  listenerSet.add(fn);
  fn({ pending: queue.length, running });
  return () => {
    listenerSet.delete(fn);
  };
}

export function getQueueSnapshot(): QueueSnapshot {
  return { pending: queue.length, running };
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Enqueue 1 embed job. No-op nếu RAG chưa ready.
 *
 * Caller phải build text trước (vd `buildNoteEmbedText(note)`).
 * Hàm sẽ tự skip nếu text fail filter (rỗng / không có chữ / dưới ngưỡng
 * theo config `minLength`).
 */
export function enqueueEmbed(
  job: Omit<EmbedJob, 'kind' | 'attempts'>,
): void {
  if (!isRagReady()) return;
  const minLength = useRagStore.getState().config.minLength;
  if (!shouldEmbedForType(job.text, job.entity_type, minLength)) return;
  // Replace job cũ cùng entity (chỉ giữ phiên bản mới nhất)
  const idx = queue.findIndex(
    (j) =>
      j.kind === 'embed' &&
      j.entity_type === job.entity_type &&
      j.entity_id === job.entity_id,
  );
  const next: EmbedJob = {
    kind: 'embed',
    entity_type: job.entity_type,
    entity_id: job.entity_id,
    text: job.text,
    metadata: job.metadata,
    attempts: 0,
  };
  if (idx >= 0) queue[idx] = next;
  else queue.push(next);

  notify();
  drain();
}

/** Enqueue 1 delete job. */
export function enqueueDelete(entity_type: EntityType, entity_id: string): void {
  if (!isRagReady()) return;
  // Xóa các job embed pending cùng entity (no point embed rồi delete)
  for (let i = queue.length - 1; i >= 0; i--) {
    const j = queue[i];
    if (j.kind === 'embed' && j.entity_type === entity_type && j.entity_id === entity_id) {
      queue.splice(i, 1);
    }
  }
  queue.push({ kind: 'delete', entity_type, entity_id, attempts: 0 });
  notify();
  drain();
}

/** Enqueue nhiều delete cùng lúc (cascade). */
export function enqueueDeleteMany(
  entity_type: EntityType,
  entity_ids: string[],
): void {
  for (const id of entity_ids) enqueueDelete(entity_type, id);
}

// ------------------------------------------------------------
// Drain worker
// ------------------------------------------------------------

function isRagReady(): boolean {
  return useRagStore.getState().status === 'ready';
}

function drain(): void {
  while (running < MAX_CONCURRENCY && queue.length > 0) {
    const job = queue.shift();
    if (!job) break;
    running++;
    notify();
    void runJob(job).finally(() => {
      running--;
      notify();
      // Delay trước khi drain tiếp — rate limit protection
      if (queue.length > 0) {
        setTimeout(drain, INTER_REQUEST_DELAY_MS);
      }
    });
  }
}

async function runJob(job: Job): Promise<void> {
  try {
    if (job.kind === 'embed') {
      await processEmbed(job);
    } else {
      await processDelete(job);
    }
  } catch (err) {
    job.attempts += 1;
    if (shouldRetry(err) && job.attempts < MAX_ATTEMPTS) {
      // Exponential backoff: 429 → đợi lâu hơn mỗi retry
      const delay = Math.min(60_000, 5_000 * Math.pow(2, job.attempts - 1));
      setTimeout(() => {
        queue.push(job);
        notify();
        drain();
      }, delay);
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `[rag-queue] Job dropped after ${job.attempts} attempts:`,
        job.kind,
        job.entity_type,
        job.entity_id,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

function shouldRetry(err: unknown): boolean {
  // Không retry nếu key chưa setup
  if (err instanceof RagNoTokenError) return false;
  // 429 tất cả keys → retry sau cooldown (backoff sẽ đợi đủ lâu)
  if (err instanceof RagAllKeysFailedError) return true;
  return true;
}

// ------------------------------------------------------------
// Job processors
// ------------------------------------------------------------

async function processEmbed(job: EmbedJob): Promise<void> {
  const text = job.text.trim();
  if (!text) {
    // Text rỗng sau khi build → coi như delete
    await deleteEmbedding(job.entity_type, job.entity_id);
    return;
  }

  const content_hash = await hashContent(text);
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  const vectors = await embedTexts(chunks);
  const pairs = chunks.map((c, i) => ({ chunk_text: c, embedding: vectors[i] }));

  await upsertEmbeddingChunks(
    {
      entity_type: job.entity_type,
      entity_id: job.entity_id,
      content_hash,
      metadata: job.metadata ?? {},
    },
    pairs,
  );
}

async function processDelete(job: DeleteJob): Promise<void> {
  await deleteEmbedding(job.entity_type, job.entity_id);
}