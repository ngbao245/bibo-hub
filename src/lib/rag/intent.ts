// ============================================================
// Intent detection — structured query support (Phase 2.5)
// ============================================================
//
// Giải quyết: user hỏi "task pending", "việc gấp", "highlight sách X"
// → cần kết hợp semantic search + metadata filter.
//
// Strategy: Pre-compute embedding cho các filter value (status, priority).
// Khi user query, cosine giữa query vector và filter vector.
// Nếu cosine > 0.7 → thêm filter_metadata vào RPC call.
//
// Safety net: nếu detect thất bại (cosine < 0.7), không thêm filter
// → pure vector search. Không miss kết quả, chỉ có thể trả về thừa.
//
// Cost: ~10 embed call 1 lần boot (cached IndexedDB), 0 cost per query.
// ============================================================

import { embedText } from './gemini';

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export interface DetectedFilters {
  /** Filter metadata cho RPC (vd {status: 'pending'}). Rỗng nếu không detect. */
  filterMetadata: Record<string, unknown> | undefined;
  /** Entity type gợi ý (vd 'task' nếu query liên quan task). */
  suggestedType: string | undefined;
}

interface FilterVector {
  label: string;
  metadataKey: string;
  metadataValue: string;
  vector: number[];
}

// ------------------------------------------------------------
// Cache
// ------------------------------------------------------------

const IDB_STORE = 'rag_filter_vectors';
const IDB_DB = 'rag_intent';
const CACHE_VERSION = 1;

let filterVectors: FilterVector[] | null = null;

// Pre-defined filter texts
const FILTER_DEFINITIONS: Array<{
  label: string;
  metadataKey: string;
  metadataValue: string;
  embedText: string;
}> = [
  {
    label: 'status:pending',
    metadataKey: 'status',
    metadataValue: 'pending',
    embedText: 'task chưa hoàn thành đang làm dang dở pending todo chưa xong',
  },
  {
    label: 'status:completed',
    metadataKey: 'status',
    metadataValue: 'completed',
    embedText: 'task đã hoàn thành xong done completed hoàn tất',
  },
  {
    label: 'priority:high',
    metadataKey: 'priority',
    metadataValue: 'high',
    embedText: 'quan trọng cao gấp khẩn urgent important high priority ưu tiên',
  },
];

// ------------------------------------------------------------
// Cosine similarity
// ------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ------------------------------------------------------------
// IndexedDB helpers
// ------------------------------------------------------------

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, CACHE_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'label' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadCachedVectors(): Promise<FilterVector[] | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = req.result as FilterVector[];
        if (rows.length === FILTER_DEFINITIONS.length) {
          resolve(rows);
        } else {
          resolve(null); // stale cache
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function saveCachedVectors(vectors: FilterVector[]): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    for (const v of vectors) {
      store.put(v);
    }
  } catch {
    // ignore
  }
}

// ------------------------------------------------------------
// Init (lazy — gọi lần đầu khi cần)
// ------------------------------------------------------------

/**
 * Ensure filter vectors loaded (from cache or compute).
 *
 * Cost: 0 nếu cache hit. ~3 embed calls nếu first time (< 500ms).
 * Non-blocking: nếu embed fail, intent detection sẽ trả rỗng (no filter applied).
 */
export async function ensureFilterVectors(): Promise<void> {
  if (filterVectors) return;

  // Try cache
  const cached = await loadCachedVectors();
  if (cached && cached.length === FILTER_DEFINITIONS.length) {
    filterVectors = cached;
    return;
  }

  // Compute
  try {
    const vectors: FilterVector[] = [];
    for (const def of FILTER_DEFINITIONS) {
      const vec = await embedText(def.embedText);
      vectors.push({
        label: def.label,
        metadataKey: def.metadataKey,
        metadataValue: def.metadataValue,
        vector: vec,
      });
    }
    filterVectors = vectors;
    await saveCachedVectors(vectors);
  } catch {
    // Fail silently — intent detection won't work but search still does
    filterVectors = [];
  }
}

// ------------------------------------------------------------
// Detect
// ------------------------------------------------------------

const SIMILARITY_THRESHOLD = 0.7;

/**
 * Detect structured filters từ query vector.
 *
 * - Chạy cosine similarity giữa queryVec và mỗi filter vector.
 * - Nếu best match > 0.7 → trả về filter_metadata tương ứng.
 * - Nếu không → trả rỗng, pure vector search.
 *
 * Khi detect status/priority → cũng gợi ý entity_type = 'task'.
 */
export async function detectFilters(
  queryVec: number[],
): Promise<DetectedFilters> {
  await ensureFilterVectors();

  if (!filterVectors || filterVectors.length === 0) {
    return { filterMetadata: undefined, suggestedType: undefined };
  }

  let best: { fv: FilterVector; score: number } | null = null;

  for (const fv of filterVectors) {
    const score = cosineSimilarity(queryVec, fv.vector);
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { fv, score };
    }
  }

  if (!best) {
    return { filterMetadata: undefined, suggestedType: undefined };
  }

  const filterMetadata: Record<string, unknown> = {
    [best.fv.metadataKey]: best.fv.metadataValue,
  };

  // Status và priority chỉ có ở tasks → gợi ý filter type
  const suggestedType =
    best.fv.metadataKey === 'status' || best.fv.metadataKey === 'priority'
      ? 'task'
      : undefined;

  return { filterMetadata, suggestedType };
}