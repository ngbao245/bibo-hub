// ============================================================
// Tool Categories — read/write from Supabase app_settings
// ============================================================
//
// Key: 'tool_categories_default'
// Value: { categories: string[], mapping: Record<toolId, category> }
//
// - categories: thứ tự hiển thị category trên Hub.
// - mapping: tool ID → category name.
// - Tool không có trong mapping → "Unassigned".
//
// Admin set default qua /config. User mới thấy default.
// Per-user override sẽ dùng user_tool_settings (tương lai).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';

const QUERY_KEY = ['tool_categories'] as const;
const SETTINGS_KEY = 'tool_categories_default';

export interface ToolCategoriesData {
  categories: string[];
  mapping: Record<string, string>;
}

const EMPTY_DATA: ToolCategoriesData = { categories: [], mapping: {} };

async function fetchToolCategories(): Promise<{
  data: ToolCategoriesData;
  recordId: string | null;
}> {
  const { data, error } = await authClient
    .from('app_settings')
    .select('key, value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();

  if (error || !data) {
    return { data: EMPTY_DATA, recordId: null };
  }

  const value = data.value as ToolCategoriesData | null;
  if (
    value &&
    Array.isArray(value.categories) &&
    value.mapping &&
    typeof value.mapping === 'object'
  ) {
    return {
      data: {
        categories: value.categories.filter((x: unknown) => typeof x === 'string'),
        mapping: value.mapping,
      },
      recordId: SETTINGS_KEY,
    };
  }

  return { data: EMPTY_DATA, recordId: SETTINGS_KEY };
}

export function useToolCategories() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchToolCategories,
    staleTime: 60_000,
  });
}

export function useSaveToolCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
    }: {
      data: ToolCategoriesData;
      recordId: string | null;
    }) => {
      const { error } = await authClient
        .from('app_settings')
        .upsert({
          key: SETTINGS_KEY,
          value: data,
          updated_at: new Date().toISOString(),
        });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}