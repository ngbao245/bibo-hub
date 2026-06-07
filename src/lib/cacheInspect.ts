// ============================================================
// Cache inspection helpers
// ============================================================
//
// Hỗ trợ:
// - Liệt kê tất cả keys trong localStorage
// - Tính size (bytes) mỗi value
// - Parse JSON nếu có thể
// - Clear, get, set
// ============================================================

export interface LocalStorageEntry {
  key: string;
  rawValue: string;
  size: number; // bytes
  parsed: unknown; // null nếu không parse được JSON
}

/** Lấy tất cả entries từ localStorage */
export function getAllLocalStorage(): LocalStorageEntry[] {
  const entries: LocalStorageEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const rawValue = localStorage.getItem(key) ?? '';
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      parsed = rawValue; // không parse được, dùng raw
    }
    entries.push({
      key,
      rawValue,
      size: new Blob([rawValue]).size,
      parsed,
    });
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

/** Format bytes thành KB/MB readable */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Tổng size localStorage */
export function getLocalStorageTotalSize(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key) ?? '';
    total += new Blob([key + value]).size;
  }
  return total;
}
