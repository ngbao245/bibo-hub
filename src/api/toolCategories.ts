
// ============================================================
// Tool Categories — sync category assignment lên /Config
// ============================================================
//
// 1 record: group="Setting", type="Category" (record id=4 đã tạo sẵn).
// config1 = JSON { categories: string[], mapping: Record<toolId, category> }
//
// - categories: thứ tự hiển thị category trên Hub.
// - mapping: tool ID → category name.
// - Tool không có trong mapping → ẩn khỏi section (vẫn hiện ở favorites nếu pin).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import { API } from '@/lib/config';
import { parseSettingList, type Setting } from '@/lib/setting';

const QUERY_KEY = ['tool_categories'] as const;
const CAT_GROUP = 'Setting';
const CAT_TYPE = 'Category';

export interface ToolCategoriesData {
  categories: string[];
  mapping: Record<string, string>;
}

const EMPTY_DATA: ToolCategoriesData = { categories: [], mapping: {} };

function findRecord(list: Setting[]): Setting | null {
  return (
    list.find(
      (s) => s.group.trim() === CAT_GROUP && s.type.trim() === CAT_TYPE,
    ) ?? null
  );
}

function parseData(record: Setting | null): ToolCategoriesData {
  if (!record?.config1) return EMPTY_DATA;
  try {
    const obj = JSON.parse(record.config1);
    if (
      obj &&
      Array.isArray(obj.categories) &&
      obj.mapping &&
      typeof obj.mapping === 'object'
    ) {
      return {
        categories: obj.categories.filter((x: unknown) => typeof x === 'string'),
        mapping: obj.mapping as Record<string, string>,
      };
    }
  } catch {
    /* ignore */
  }
  return EMPTY_DATA;
}

async function fetchToolCategories(): Promise<{
  data: ToolCategoriesData;
  recordId: string | null;
}> {
  const raw = await fetchJson<unknown>(API.CONFIGS);
  const list = parseSettingList(raw);
  const record = findRecord(list);
  return { data: parseData(record), recordId: record?.id ?? null };
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
      recordId,
    }: {
      data: ToolCategoriesData;
      recordId: string | null;
    }) => {
      const body = {
        name: '',
        description: '',
        group: CAT_GROUP,
        type: CAT_TYPE,
        config1: JSON.stringify(data),
        config2: '',
        config3: '',
        config4: '',
        config5: '',
        config6: '',
        config7: '',
        config8: '',
        config9: '',
        config10: '',
      };

      if (recordId) {
        await fetchJson(`${API.CONFIGS}/${recordId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await fetchJson(API.CONFIGS, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}