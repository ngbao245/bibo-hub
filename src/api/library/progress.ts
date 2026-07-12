import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/library/supabase';
import type { ReadingProgress } from '@/lib/library/types';

export function useProgress(bookId: string | undefined) {
  return useQuery({
    queryKey: ['reader', 'progress', bookId],
    enabled: !!bookId,
    queryFn: async (): Promise<ReadingProgress | null> => {
      const { data, error } = await supabase
        .from('reading_progress')
        .select('*')
        .eq('book_id', bookId)
        .maybeSingle();
      if (error) throw error;
      return (data as ReadingProgress | null) ?? null;
    },
  });
}

/**
 * Fetch progress của TẤT CẢ books → map theo book_id. Dùng ở Library để
 * hiện "trang X / Y · Z%" trên mỗi card mà không cần N queries riêng lẻ.
 */
export function useAllProgress() {
  return useQuery({
    queryKey: ['reader', 'progress', 'all'],
    queryFn: async (): Promise<Map<string, ReadingProgress>> => {
      const { data, error } = await supabase.from('reading_progress').select('*');
      if (error) throw error;
      const map = new Map<string, ReadingProgress>();
      for (const row of (data ?? []) as ReadingProgress[]) {
        map.set(row.book_id, row);
      }
      return map;
    },
    // Cache lâu hơn (5 phút) — progress chỉ đổi khi user đọc, không quan trọng tươi tuyệt đối
    staleTime: 5 * 60_000,
  });
}

export function useSaveProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { bookId: string; location: string; progress: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('reading_progress').upsert(
        {
          user_id: userData.user.id,
          book_id: input.bookId,
          location: input.location,
          progress: input.progress,
          updated_at: new Date().toISOString(),
        },
        // Match thứ tự cột trong constraint UNIQUE (book_id, user_id)
        { onConflict: 'book_id,user_id' },
      );
      if (error) throw error;
    },
    // Không invalidate — restore page chỉ chạy 1 lần khi mở book. Update
    // cache trực tiếp để các consumer khác (analytics, future progress bar)
    // vẫn thấy giá trị mới mà không gây refetch + feedback loop.
    onSuccess: (_data, vars) => {
      qc.setQueryData(['reader', 'progress', vars.bookId], (old: ReadingProgress | null | undefined) => {
        const base = old ?? { id: '', user_id: '', book_id: vars.bookId };
        return {
          ...base,
          location: vars.location,
          progress: vars.progress,
          updated_at: new Date().toISOString(),
        } as ReadingProgress;
      });
      // Cập nhật cả map "all" nếu đang được cache để Library hiện ngay khi quay lại
      qc.setQueryData<Map<string, ReadingProgress> | undefined>(
        ['reader', 'progress', 'all'],
        (old) => {
          if (!old) return old;
          const next = new Map(old);
          const existing = next.get(vars.bookId);
          const base = existing ?? { id: '', user_id: '', book_id: vars.bookId };
          next.set(vars.bookId, {
            ...base,
            location: vars.location,
            progress: vars.progress,
            updated_at: new Date().toISOString(),
          } as ReadingProgress);
          return next;
        },
      );
    },
  });
}