// ============================================================
// PDF Studio — IndexedDB storage adapter
// ============================================================
// Manages temporary blob storage for:
//   - Input files (pending upload / retry)
//   - Output files (cached from provider, awaiting download)
//
// Separate object stores with lease/cleanup metadata.
// Namespace: 'pdf-studio-cache'
// ============================================================

const DB_NAME = 'pdf-studio-cache';
const DB_VERSION = 1;
const STORE_INPUT = 'inputs';
const STORE_OUTPUT = 'outputs';

export interface StoredBlob {
  id: string; // job_id
  filename: string;
  blob: Blob;
  size: number;
  mime: string;
  /** Fingerprint for re-matching after browser restart */
  fingerprint?: string;
  /** When this entry was stored */
  storedAt: number;
  /** Active lease — do not cleanup while leased */
  leaseUntil?: number;
  /** First download timestamp — grace period starts here */
  firstDownloadAt?: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_INPUT)) {
        db.createObjectStore(STORE_INPUT, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_OUTPUT)) {
        db.createObjectStore(STORE_OUTPUT, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Input storage ──────────────────────────────────────────

export async function storeInput(jobId: string, file: File): Promise<void> {
  const db = await openDb();
  const entry: StoredBlob = {
    id: jobId,
    filename: file.name,
    blob: file,
    size: file.size,
    mime: file.type,
    fingerprint: `${file.name}|${file.size}|${file.lastModified}`,
    storedAt: Date.now(),
    leaseUntil: Date.now() + 24 * 60 * 60 * 1000, // 24h default lease
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INPUT, 'readwrite');
    tx.objectStore(STORE_INPUT).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getInput(jobId: string): Promise<StoredBlob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INPUT, 'readonly');
    const request = tx.objectStore(STORE_INPUT).get(jobId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteInput(jobId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_INPUT, 'readwrite');
    tx.objectStore(STORE_INPUT).delete(jobId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Output storage ─────────────────────────────────────────

export async function storeOutput(jobId: string, blob: Blob, filename: string): Promise<void> {
  const db = await openDb();
  const entry: StoredBlob = {
    id: jobId,
    filename,
    blob,
    size: blob.size,
    mime: blob.type,
    storedAt: Date.now(),
    leaseUntil: Date.now() + 24 * 60 * 60 * 1000,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTPUT, 'readwrite');
    tx.objectStore(STORE_OUTPUT).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOutput(jobId: string): Promise<StoredBlob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTPUT, 'readonly');
    const request = tx.objectStore(STORE_OUTPUT).get(jobId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOutput(jobId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTPUT, 'readwrite');
    tx.objectStore(STORE_OUTPUT).delete(jobId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markDownloaded(jobId: string): Promise<void> {
  const db = await openDb();
  const existing = await getOutput(jobId);
  if (!existing) return;

  existing.firstDownloadAt = existing.firstDownloadAt ?? Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTPUT, 'readwrite');
    tx.objectStore(STORE_OUTPUT).put(existing);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Cleanup ────────────────────────────────────────────────

export interface CleanupPolicy {
  /** Minutes after first download before output is eligible for cleanup */
  graceMinutes: number;
  /** Hours of safety retention for abandoned blobs */
  safetyRetentionHours: number;
}

/**
 * Run cleanup pass. Removes:
 * 1. Outputs past grace period (downloaded + grace expired)
 * 2. Abandoned entries past safety retention
 * 3. Inputs with expired lease and no active job reference
 *
 * Returns number of entries removed.
 */
export async function runCleanup(
  policy: CleanupPolicy,
  activeJobIds: Set<string>,
): Promise<number> {
  const db = await openDb();
  const now = Date.now();
  const graceMs = policy.graceMinutes * 60 * 1000;
  const safetyMs = policy.safetyRetentionHours * 60 * 60 * 1000;
  let removed = 0;

  // Cleanup outputs
  const outputsToDelete = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTPUT, 'readonly');
    const store = tx.objectStore(STORE_OUTPUT);
    const request = store.getAll();
    request.onsuccess = () => {
      const entries = request.result as StoredBlob[];
      const ids: string[] = [];
      for (const entry of entries) {
        // Skip active jobs
        if (activeJobIds.has(entry.id)) continue;
        // Grace period expired
        if (entry.firstDownloadAt && now - entry.firstDownloadAt > graceMs) {
          ids.push(entry.id);
          continue;
        }
        // Safety retention expired (no download, abandoned)
        if (!entry.firstDownloadAt && now - entry.storedAt > safetyMs) {
          ids.push(entry.id);
        }
      }
      resolve(ids);
    };
    request.onerror = () => reject(request.error);
  });

  for (const id of outputsToDelete) {
    await deleteOutput(id);
    removed++;
  }

  // Cleanup inputs
  const inputsToDelete = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE_INPUT, 'readonly');
    const store = tx.objectStore(STORE_INPUT);
    const request = store.getAll();
    request.onsuccess = () => {
      const entries = request.result as StoredBlob[];
      const ids: string[] = [];
      for (const entry of entries) {
        // Skip active jobs
        if (activeJobIds.has(entry.id)) continue;
        // Lease expired
        if (entry.leaseUntil && now > entry.leaseUntil) {
          ids.push(entry.id);
          continue;
        }
        // Safety retention (no lease, old)
        if (!entry.leaseUntil && now - entry.storedAt > safetyMs) {
          ids.push(entry.id);
        }
      }
      resolve(ids);
    };
    request.onerror = () => reject(request.error);
  });

  for (const id of inputsToDelete) {
    await deleteInput(id);
    removed++;
  }

  return removed;
}

/**
 * Get storage estimate for PDF Studio cache.
 */
export async function getStorageEstimate(): Promise<{ used: number; available: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return {
    used: estimate.usage ?? 0,
    available: (estimate.quota ?? 0) - (estimate.usage ?? 0),
  };
}

/**
 * Clear all PDF Studio cache (user action "Don ngay").
 */
export async function clearAllCache(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_INPUT, STORE_OUTPUT], 'readwrite');
    tx.objectStore(STORE_INPUT).clear();
    tx.objectStore(STORE_OUTPUT).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
