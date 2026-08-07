// ============================================================
// PDF Studio Edit PDF — IndexedDB draft persistence
// ============================================================
// Document session model:
// - originalPdf: immutable uploaded PDF blob
// - workingRevision: current PDF after OCR/page ops (null = same as original)
// - overlayObjects: JSON array of editor objects
// - assets: binary blobs (images) stored separately, referenced by assetId
// - jobState: OCR job tracking state for reload recovery
// - version: revision counter to detect stale/corrupt data
// ============================================================

const DB_NAME = 'pdf-studio-editor';
const DB_VERSION = 1;

const STORE_DRAFTS = 'drafts';
const STORE_ASSETS = 'assets';

export interface DraftMeta {
  draftId: string;
  filename: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  thumbnailDataUrl: string | null;
  version: number;
  totalPages: number;
}

export interface DraftData {
  draftId: string;
  filename: string;
  originalPdf: Blob;
  workingRevision: Blob | null; // null = same as original
  overlayObjects: string; // JSON string
  jobState: string | null; // JSON string for OCR job tracking
  createdAt: string;
  updatedAt: string;
  thumbnailDataUrl: string | null;
  version: number;
  totalPages: number;
  currentPage: number;
  zoom: number;
}

export interface AssetEntry {
  assetId: string;
  draftId: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
}

// ─── DB init ─────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'draftId' });
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        const store = db.createObjectStore(STORE_ASSETS, { keyPath: 'assetId' });
        store.createIndex('byDraft', 'draftId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Draft CRUD ──────────────────────────────────────────────

export async function saveDraft(data: DraftData): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    tx.objectStore(STORE_DRAFTS).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDraft(draftId: string): Promise<DraftData | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readonly');
    const req = tx.objectStore(STORE_DRAFTS).get(draftId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listDrafts(): Promise<DraftMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readonly');
    const req = tx.objectStore(STORE_DRAFTS).getAll();
    req.onsuccess = () => {
      const all = (req.result as DraftData[]).map((d) => ({
        draftId: d.draftId,
        filename: d.filename,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        thumbnailDataUrl: d.thumbnailDataUrl,
        version: d.version,
        totalPages: d.totalPages,
      }));
      // Sort by updatedAt descending
      all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDraft(draftId: string): Promise<void> {
  const db = await openDb();

  // Delete assets belonging to this draft
  const assetTx = db.transaction(STORE_ASSETS, 'readwrite');
  const idx = assetTx.objectStore(STORE_ASSETS).index('byDraft');
  const cursor = idx.openKeyCursor(IDBKeyRange.only(draftId));

  await new Promise<void>((resolve, reject) => {
    const keysToDelete: IDBValidKey[] = [];
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        keysToDelete.push(c.primaryKey);
        c.continue();
      } else {
        // Delete all found keys
        for (const key of keysToDelete) {
          assetTx.objectStore(STORE_ASSETS).delete(key);
        }
        resolve();
      }
    };
    cursor.onerror = () => reject(cursor.error);
    assetTx.onerror = () => reject(assetTx.error);
  });

  // Delete draft record
  const draftTx = db.transaction(STORE_DRAFTS, 'readwrite');
  return new Promise((resolve, reject) => {
    draftTx.objectStore(STORE_DRAFTS).delete(draftId);
    draftTx.oncomplete = () => resolve();
    draftTx.onerror = () => reject(draftTx.error);
  });
}

// ─── Assets ──────────────────────────────────────────────────

export async function saveAsset(entry: AssetEntry): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readwrite');
    tx.objectStore(STORE_ASSETS).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAsset(assetId: string): Promise<AssetEntry | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readonly');
    const req = tx.objectStore(STORE_ASSETS).get(assetId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAssetsByDraft(draftId: string): Promise<AssetEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readonly');
    const idx = tx.objectStore(STORE_ASSETS).index('byDraft');
    const req = idx.getAll(IDBKeyRange.only(draftId));
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

// ─── Quota check ─────────────────────────────────────────────

export async function checkStorageQuota(): Promise<{ usage: number; quota: number; percentUsed: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota, percentUsed: quota > 0 ? (usage / quota) * 100 : 0 };
  }
  return { usage: 0, quota: 0, percentUsed: 0 };
}
