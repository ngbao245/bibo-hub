// ============================================================
// Book stats — count highlights + progress cho DeleteConfirmDialog
// ============================================================
//
// Dùng để hiển thị dữ liệu cascade trước khi user click Delete.
//
// LƯU Ý RLS: policy `highlights_select_own` + `progress_select_own` filter
// `user_id = auth.uid()` áp cho MỌI authenticated user, kể cả admin. Vì
// migration hiện tại KHÔNG có bypass cho admin, `highlightsCount` chỉ đếm
// highlights của user hiện tại, không phải toàn sách. UI phải gọi rõ
// "highlights của bạn" thay vì "highlights của sách". Muốn đếm cross-user,
// cần thêm RPC `security definer` (chưa impl).
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/tools/library/lib/supabase';

export interface BookStats {
  /** Highlights của user hiện tại (RLS filter). */
  myHighlightsCount: number;
  /**
   * Progress của user hiện tại (RLS filter → 0 hoặc 1 row).
   * null = user chưa đọc sách này.
   */
  myProgress: { page: string | null; percent: number } | null;
}

async function fetchBookStats(bookId: string): Promise<BookStats> {
  const [highlightsRes, progressRes] = await Promise.all([
    // Chỉ cần count, không cần data → dùng head:true để bỏ payload.
    supabase
      .from('highlights')
      .select('user_id', { count: 'exact', head: true })
      .eq('book_id', bookId),
    supabase
      .from('reading_progress')
      .select('location, progress')
      .eq('book_id', bookId)
      .maybeSingle(),
  ]);

  if (highlightsRes.error) throw highlightsRes.error;
  if (progressRes.error) throw progressRes.error;

  const row = progressRes.data as { location: string | null; progress: number | null } | null;
  const myProgress = row
    ? {
        page: row.location,
        percent: Math.round((row.progress ?? 0) * 100),
      }
    : null;

  return {
    myHighlightsCount: highlightsRes.count ?? 0,
    myProgress,
  };
}

export function useBookStats(bookId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['reader', 'book-stats', bookId],
    enabled: !!bookId && enabled,
    queryFn: () => fetchBookStats(bookId as string),
    // Stats không đổi thường xuyên, cache 1 phút để tránh re-query khi
    // dialog re-open nhanh.
    staleTime: 60_000,
  });
}