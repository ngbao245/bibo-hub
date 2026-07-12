// =============================================================
// Storage usage — đếm dung lượng ĐÃ DÙNG cho bucket `books` (shared).
//
// Sau spec library-migrate-to-project-a: Library shared, mọi user thấy
// mọi sách. Quota 1 GB là quota PROJECT (Supabase free tier), không
// phải per-user. Query list toàn bucket + sum size — RLS SELECT đã
// cho phép mọi authenticated.
//
// Structure path trong bucket `books`:
//   {timestamp}_{name}.pdf       — file sách (flat, không user prefix)
//   covers/{timestamp}_{name}.png — cover trang 1
//
// Legacy path (data cũ Project B đã migrate qua): {userId}/*.pdf — vẫn
// đọc được vì `sumPrefix('')` đệ quy full bucket.
// =============================================================

import { useQuery } from '@tanstack/react-query';
import { supabase, BUCKET } from '@/lib/library/supabase';

/** Free tier Supabase = 1 GB storage. Đổi đây khi upgrade plan. */
export const STORAGE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024;

/** Ngưỡng cảnh báo user khi bucket sắp đầy. */
export const STORAGE_WARN_THRESHOLD = 0.8; // 80%

export interface StorageUsage {
  /** Tổng byte đã dùng */
  used: number;
  /** Số object trong bucket (cả file + cover) */
  count: number;
  /** Hạn mức tier hiện tại (byte) */
  limit: number;
}

/** Đệ quy: list `prefix`, gặp folder thì list tiếp. */
async function sumPrefix(prefix: string): Promise<{ size: number; count: number }> {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;
  if (!data) return { size: 0, count: 0 };

  let size = 0;
  let count = 0;
  for (const item of data) {
    // Folder thì `metadata` null và `id` null. File thì có metadata.size.
    if (item.metadata && typeof item.metadata.size === 'number') {
      size += item.metadata.size;
      count += 1;
    } else if (item.id === null) {
      // Subfolder — đệ quy vào (VD: covers/, user-uuid/ legacy)
      const sub = await sumPrefix(prefix ? `${prefix}/${item.name}` : item.name);
      size += sub.size;
      count += sub.count;
    }
  }
  return { size, count };
}

async function fetchStorageUsage(): Promise<StorageUsage> {
  const { size, count } = await sumPrefix('');
  return { used: size, count, limit: STORAGE_LIMIT_BYTES };
}

/** True nếu bucket đã vượt ngưỡng cảnh báo. Dùng trong upload flow. */
export function isStorageWarn(usage: StorageUsage | null | undefined): boolean {
  if (!usage) return false;
  return usage.used / usage.limit >= STORAGE_WARN_THRESHOLD;
}

export function useReaderStorageUsage() {
  return useQuery({
    queryKey: ['reader', 'storage-usage'],
    queryFn: fetchStorageUsage,
    // Usage không đổi liên tục — 5 phút stale là vừa đủ.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}