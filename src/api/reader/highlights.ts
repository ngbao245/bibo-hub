import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/reader/supabase';
import type { Highlight, HighlightLocation } from '@/lib/reader/types';
import { dualWriteHighlight, dualDeleteHighlight } from '@/lib/rag/dual-write';

export function useHighlights(bookId: string | undefined) {
  return useQuery({
    queryKey: ['reader', 'highlights', bookId],
    enabled: !!bookId,
    queryFn: async (): Promise<Highlight[]> => {
      const { data, error } = await supabase
        .from('highlights')
        .select('*')
        .eq('book_id', bookId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as Highlight[]) ?? [];
    },
  });
}

export function useCreateHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bookId: string;
      location: HighlightLocation;
      text: string;
      note?: string;
      color?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('highlights')
        .insert({
          user_id: userData.user.id,
          book_id: input.bookId,
          location: input.location,
          // Legacy column — luôn null cho row mới (PDF)
          cfi_range: null,
          text: input.text,
          note: input.note ?? null,
          color: input.color ?? 'yellow',
        })
        .select()
        .single();
      if (error) throw error;
      return data as Highlight;
    },
    onSuccess: (h, vars) => {
      if (h?.id) dualWriteHighlight(h);
      qc.invalidateQueries({ queryKey: ['reader', 'highlights', vars.bookId] });
    },
  });
}

export function useUpdateHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; bookId: string; note?: string; color?: string }) => {
      const patch: Record<string, unknown> = {};
      if (input.note !== undefined) patch.note = input.note;
      if (input.color !== undefined) patch.color = input.color;
      const { data, error } = await supabase
        .from('highlights')
        .update(patch)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as Highlight;
    },
    onSuccess: (h, vars) => {
      if (h?.id) dualWriteHighlight(h);
      qc.invalidateQueries({ queryKey: ['reader', 'highlights', vars.bookId] });
    },
  });
}

export function useDeleteHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; bookId: string }) => {
      const { error } = await supabase.from('highlights').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      dualDeleteHighlight(vars.id);
      qc.invalidateQueries({ queryKey: ['reader', 'highlights', vars.bookId] });
    },
  });
}