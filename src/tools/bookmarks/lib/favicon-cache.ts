// =============================================================
// Favicon cache (IndexedDB) — instant load on revisit.
// =============================================================
//
// Mục tiêu: lần đầu tải favicon qua network → cache Blob vào IndexedDB.
// Lần mở lại → load từ DB (vài ms) thay vì network round-trip.
//
// Schema:
//   DB: "bibo-bookmark-favicons" (version 1)
//   Store: "favicons"  key=url+size, value={ blob, size, last_accessed }
//
// Eviction: LRU khi vượt budget (30MB — favicon nhỏ, đủ vài trăm cái).
// TTL: 30 ngày. Favicon ít đổi, giữ lâu OK.

const DB_NAME = 'bibo-bookmark-favicons';
const DB_VERSION = 1;
const STORE = 'favicons';

const BUDGET_BYTES = 30 * 1024 * 1024; // 30MB
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const s = t.objectStore(STORE);
        const req = fn(s);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** Build stable cache key: URL + display size (transformed URLs vary per size). */
export function cacheKey(url: string, size: number): string {
  return `${url}#${size}`;
}

/** Get cached blob. Returns null if miss or expired. Updates last_accessed on hit. */
export async function getCachedFavicon(key: string): Promise<Blob | null> {
  try {
    const entry = await tx<Entry | undefined>('readonly', (s) => s.get(key));
    if (!entry) return null;
    if (Date.now() - entry.last_accessed > TTL_MS) {
      void deleteFavicon(key).catch(() => {});
      return null;
    }
    // Fire-and-forget touch to keep LRU order fresh.
    void touchEntry(key).catch(() => {});
    return entry.blob;
  } catch {
    return null;
  }
}

async function touchEntry(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
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
}

/** Store blob. Best-effort — errors swallowed (cache failure never blocks UI). */
export async function putCachedFavicon(key: string, blob: Blob): Promise<void> {
  try {
    await tx<IDBValidKey>('readwrite', (s) =>
      s.put({ key, blob, size: blob.size, last_accessed: Date.now() } satisfies Entry),
    );
    void evictIfNeeded().catch(() => {});
  } catch {
    // Silent — cache failure shouldn't block UI.
  }
}

export async function deleteFavicon(key: string): Promise<void> {
  await tx<undefined>('readwrite', (s) => s.delete(key)).catch(() => {});
}

/** Delete all cache entries whose key starts with this URL prefix (any size). */
export async function invalidateFavicon(url: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE, 'readwrite');
      const s = t.objectStore(STORE);
      const req = s.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        if (typeof cursor.key === 'string' && cursor.key.startsWith(url + '#')) {
          cursor.delete();
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    // best-effort
  }
}

async function listEntries(): Promise<Array<Omit<Entry, 'blob'>>> {
  try {
    const db = await openDb();
    return await new Promise<Array<Omit<Entry, 'blob'>>>((resolve, reject) => {
      const out: Array<Omit<Entry, 'blob'>> = [];
      const t = db.transaction(STORE, 'readonly');
      const s = t.objectStore(STORE);
      const req = s.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(out);
        const e = cursor.value as Entry;
        out.push({ key: e.key, size: e.size, last_accessed: e.last_accessed });
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function evictIfNeeded(): Promise<void> {
  const entries = await listEntries();
  let total = entries.reduce((s, e) => s + e.size, 0);
  if (total <= BUDGET_BYTES) return;
  entries.sort((a, b) => a.last_accessed - b.last_accessed);
  for (const e of entries) {
    if (total <= BUDGET_BYTES) break;
    await deleteFavicon(e.key);
    total -= e.size;
  }
}

/**
 * Fetch a favicon through cache. Returns blob URL (createObjectURL result).
 * Caller must call URL.revokeObjectURL() when done.
 *
 * On network failure, throws — caller handles fallback UI.
 */
export async function fetchFaviconThroughCache(url: string, size: number): Promise<string> {
  const key = cacheKey(url, size);
  const cached = await getCachedFavicon(key);
  if (cached) return URL.createObjectURL(cached);
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  void putCachedFavicon(key, blob);
  return URL.createObjectURL(blob);
}

/** Best-effort clear cache — used by "Refresh favicon" action. */
export async function invalidateFaviconEntries(url: string): Promise<void> {
  return invalidateFavicon(url);
}
