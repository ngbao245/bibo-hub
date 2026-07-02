// =============================================================
// Storage usage — đếm dung lượng đã dùng cho reader bucket.
//
// Vì Supabase Management API (PAT) bị CORS chặn từ browser, hướng
// duy nhất khả thi là list objects trong bucket của user hiện tại
// rồi sum `metadata.size`. Đủ chính xác cho reader vì mỗi user chỉ
// xem dung lượng của chính mình.
//
// Structure path trong bucket `books`:
//   {userId}/{timestamp}_{name}.pdf       — file sách
//   {userId}/covers/{timestamp}_{name}.png — cover trang 1
// =============================================================

import { useQuery } from '@tanstack/react-query';
import { supabase, BUCKET } from '@/lib/reader/supabase';

/** Free tier Supabase = 1 GB storage. Đổi đây khi upgrade plan. */
export const STORAGE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024;

export interface StorageUsage {
  /** Tổng byte đã dùng */
  used: number;
  /** Số object trong bucket (cả file + cover) */
  count: number;
  /** Hạn mức tier hiện tại (byte) */
  limit: number;
}

/** Đệ quy 1 cấp: list `prefix`, gặp folder thì list tiếp. */
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
      // Subfolder — đệ quy vào
      const sub = await sumPrefix(`${prefix}/${item.name}`);
      size += sub.size;
      count += sub.count;
    }
  }
  return { size, count };
}

async function fetchStorageUsage(): Promise<StorageUsage> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  const { size, count } = await sumPrefix(data.user.id);
  return { used: size, count, limit: STORAGE_LIMIT_BYTES };
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