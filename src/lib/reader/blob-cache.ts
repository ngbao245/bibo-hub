// =============================================================
// Blob cache (IndexedDB) — cho file EPUB/PDF + cover image.
// =============================================================
//
// Mục tiêu: lần đầu tải sách qua Supabase Storage signed URL → cache Blob
// vào IndexedDB. Lần mở lại → load từ DB (vài ms) thay vì re-download
// hàng MB từ network.
//
// Schema:
//   DB: "reader-cache" (version 1)
//   Stores:
//     - "files": key=path (string), value={ blob, size, last_accessed }
//     - "covers": tương tự
//
// Eviction: LRU theo `last_accessed`. Mỗi store có budget riêng. Khi vượt
// → xoá entries cũ nhất tới khi đủ chỗ.
//
// Quota an toàn cho persistent storage trên 1 origin: vài chục MB không
// cần xin permission. Lớn hơn nên gọi `navigator.storage.persist()` —
// để tự nhiên, không xin.

const DB_NAME = 'reader-cache';
const DB_VERSION = 1;

export const STORE_FILES = 'files';
export const STORE_COVERS = 'covers';

/** Budget mặc định cho mỗi store (bytes). Override khi gọi put. */
const DEFAULT_BUDGET: Record<string, number> = {
  [STORE_FILES]: 200 * 1024 * 1024, // 200MB cho EPUB/PDF
  [STORE_COVERS]: 30 * 1024 * 1024, // 30MB cho cover thumbnails
};

interface Entry {
  key: string;
  blob: Blob;
  size: number;
  last_accessed: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_COVERS)) {
        db.createObjectStore(STORE_COVERS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const result = fn(s);
        if (result instanceof IDBRequest) {
          result.onsuccess = () => resolve(result.result as T);
          result.onerror = () => reject(result.error);
        } else {
          // Promise: chờ resolve rồi commit
          result.then(resolve, reject);
        }
      }),
  );
}

export async function getCached(store: string, key: string): Promise<Blob | null> {
  try {
    const entry = await tx<Entry | undefined>(store, 'readonly', (s) => s.get(key));
    if (!entry) return null;
    // Cập nhật last_accessed lazily để LRU đúng
    void touch(store, key).catch(() => { });
    return entry.blob;
  } catch {
    return null;
  }
}

async function touch(store: string, key: string): Promise<void> {
  await tx<void>(store, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const getReq = s.get(key);
      getReq.onsuccess = () => {
        const e = getReq.result as Entry | undefined;
        if (!e) return resolve();
        e.last_accessed = Date.now();
        const putReq = s.put(e);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
}

export async function putCached(
  store: string,
  key: string,
  blob: Blob,
): Promise<void> {
  const budget = DEFAULT_BUDGET[store] ?? 50 * 1024 * 1024;
  // Ưu tiên ghi entry mới rồi evict — nếu evict fail vẫn còn entry mới
  try {
    await tx<void>(store, 'readwrite', (s) => {
      const entry: Entry = {
        key,
        blob,
        size: blob.size,
        last_accessed: Date.now(),
      };
      return new Promise<void>((resolve, reject) => {
        const req = s.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    // Evict best-effort — không throw nếu fail
    await evictIfNeeded(store, budget).catch(() => { });
  } catch (err) {
    // QuotaExceededError → thử evict rồi retry 1 lần
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      await evictIfNeeded(store, budget * 0.7).catch(() => { });
      // Best-effort retry
      await tx<void>(store, 'readwrite', (s) => {
        const entry: Entry = {
          key,
          blob,
          size: blob.size,
          last_accessed: Date.now(),
        };
        return new Promise<void>((resolve, reject) => {
          const req = s.put(entry);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }).catch(() => { });
    }
    // Không throw — cache fail không nên block reader
  }
}

export async function deleteCached(store: string, key: string): Promise<void> {
  await tx<void>(store, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }).catch(() => { });
}

export async function clearStore(store: string): Promise<void> {
  await tx<void>(store, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }).catch(() => { });
}

export async function listEntries(store: string): Promise<Array<Omit<Entry, 'blob'>>> {
  return tx<Array<Omit<Entry, 'blob'>>>(store, 'readonly', (s) => {
    return new Promise<Array<Omit<Entry, 'blob'>>>((resolve, reject) => {
      const out: Array<Omit<Entry, 'blob'>> = [];
      const req = s.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(out);
          return;
        }
        const e = cursor.value as Entry;
        out.push({ key: e.key, size: e.size, last_accessed: e.last_accessed });
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }).catch(() => []);
}

async function evictIfNeeded(store: string, budget: number): Promise<void> {
  const entries = await listEntries(store);
  let total = entries.reduce((s, e) => s + e.size, 0);
  if (total <= budget) return;
  // LRU: sort cũ nhất trước, xoá tới khi total ≤ budget
  entries.sort((a, b) => a.last_accessed - b.last_accessed);
  for (const e of entries) {
    if (total <= budget) break;
    await deleteCached(store, e.key);
    total -= e.size;
  }
}

/**
 * Convenience: fetch URL với cache layer.
 * - Có blob trong store + key → trả blob (không gọi urlProvider).
 * - Không → gọi urlProvider() để lấy URL (lazy, để khỏi sign mạng khi không cần),
 *   fetch về, put vào store, trả blob.
 */
export async function fetchThroughCache(
  store: string,
  key: string,
  urlProvider: () => Promise<string> | string,
): Promise<Blob> {
  const cached = await getCached(store, key);
  if (cached) return cached;

  const url = await urlProvider();

  // Retry logic for large files or network issues
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (import.meta.env.DEV) {
        console.log(`[blob-cache] Fetching ${key} (attempt ${attempt}/3)...`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
        },
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const blob = await res.blob();

      if (import.meta.env.DEV) {
        console.log(`[blob-cache] Successfully fetched ${key}, size: ${blob.size} bytes`);
      }

      void putCached(store, key, blob);
      return blob;

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (import.meta.env.DEV) {
        console.warn(`[blob-cache] Attempt ${attempt} failed:`, lastError.message);
      }

      if (attempt < 3) {
        const delay = attempt * 1000;
        if (import.meta.env.DEV) {
          console.log(`[blob-cache] Retrying after ${delay}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to fetch after 3 attempts');
}