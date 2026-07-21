// ============================================================
// Shortcut Overrides — per-user key bindings via Supabase user_tool_settings
// ============================================================
//
// Lưu trong user_tool_settings WHERE tool_code = '__hub'
// → settings_json.shortcuts = Record<shortcutId, { key, enabled }>
//
// User chưa có record → không có shortcut override (dùng default system shortcuts).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import { useAuthStore } from '@/stores/authStore';

const QUERY_KEY = ['shortcut_overrides'] as const;
const TOOL_CODE = '__hub';

export interface ShortcutOverride {
  key: string;
  enabled: boolean;
}

export type ShortcutOverridesData = Record<string, ShortcutOverride>;

const EMPTY: ShortcutOverridesData = {};

export function useShortcutOverrides() {
  const userId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: [...QUERY_KEY, userId],
    queryFn: async (): Promise<{
      data: ShortcutOverridesData;
      recordId: string | null;
    }> => {
      if (!userId) return { data: EMPTY, recordId: null };

      const { data, error } = await authClient
        .from('user_tool_settings')
        .select('id, settings_json')
        .eq('user_id', userId)
        .eq('tool_code', TOOL_CODE)
        .maybeSingle();

      if (error || !data) return { data: EMPTY, recordId: null };

      const settings = data.settings_json as Record<string, unknown> | null;
      const shortcuts = settings?.shortcuts;

      if (shortcuts && typeof shortcuts === 'object' && !Array.isArray(shortcuts)) {
        const out: ShortcutOverridesData = {};
        for (const [id, val] of Object.entries(shortcuts as Record<string, unknown>)) {
          if (
            val &&
            typeof val === 'object' &&
            'key' in val &&
            'enabled' in val &&
            typeof (val as Record<string, unknown>).key === 'string' &&
            typeof (val as Record<string, unknown>).enabled === 'boolean'
          ) {
            out[id] = val as ShortcutOverride;
          }
        }
        return { data: out, recordId: data.id };
      }

      return { data: EMPTY, recordId: data.id };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useSaveShortcutOverrides() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async ({
      data,
      recordId,
    }: {
      data: ShortcutOverridesData;
      recordId: string | null;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      if (recordId) {
        // Update existing — merge shortcuts into settings_json
        const { data: existing } = await authClient
          .from('user_tool_settings')
          .select('settings_json')
          .eq('id', recordId)
          .single();

        const current = (existing?.settings_json as Record<string, unknown>) ?? {};
        const merged = { ...current, shortcuts: data };

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
            settings_json: { shortcuts: data },
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