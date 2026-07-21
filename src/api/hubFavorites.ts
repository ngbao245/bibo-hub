// ============================================================
// Hub Favorites — per-user pinned tools via Supabase user_tool_settings
// ============================================================
//
// Lưu trong user_tool_settings WHERE tool_code = '__hub'
// → settings_json.favorites = string[] (tool IDs)
//
// User chưa có record → favorites trống (tự pin).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import { useAuthStore } from '@/stores/authStore';

const QUERY_KEY = ['hub_favorites'] as const;
const TOOL_CODE = '__hub';

export function useHubFavorites() {
  const userId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: [...QUERY_KEY, userId],
    queryFn: async (): Promise<{ ids: string[]; recordId: string | null }> => {
      if (!userId) return { ids: [], recordId: null };

      const { data, error } = await authClient
        .from('user_tool_settings')
        .select('id, settings_json')
        .eq('user_id', userId)
        .eq('tool_code', TOOL_CODE)
        .maybeSingle();

      if (error || !data) return { ids: [], recordId: null };

      const settings = data.settings_json as Record<string, unknown> | null;
      const favorites = Array.isArray(settings?.favorites) ? settings.favorites as string[] : [];

      return { ids: favorites, recordId: data.id };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useSaveHubFavorites() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async ({ ids, recordId }: { ids: string[]; recordId: string | null }) => {
      if (!userId) throw new Error('Not authenticated');

      if (recordId) {
        // Update existing record — merge favorites into settings_json
        const { data: existing } = await authClient
          .from('user_tool_settings')
          .select('settings_json')
          .eq('id', recordId)
          .single();

        const current = (existing?.settings_json as Record<string, unknown>) ?? {};
        const merged = { ...current, favorites: ids };

        const { error } = await authClient
          .from('user_tool_settings')
          .update({ settings_json: merged, updated_at: new Date().toISOString() })
          .eq('id', recordId);

        if (error) throw new Error(error.message);
      } else {
        // Create new record
        const { error } = await authClient
          .from('user_tool_settings')
          .insert({
            user_id: userId,
            tool_code: TOOL_CODE,
            settings_json: { favorites: ids },
            is_enabled: true,
          });

        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}