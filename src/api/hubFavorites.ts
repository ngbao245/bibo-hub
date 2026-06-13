
// ============================================================
// Hub Favorites — sync pinned tools lên /Config
// ============================================================
//
// Lưu 1 record duy nhất: group="__system", type="hub_favorites".
// config1 chứa JSON array tool IDs (plain, không encrypt).
//
// Logic:
//   - Load: tìm record __system/hub_favorites → parse config1.
//   - Save: PUT record (tạo nếu chưa có).
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import { API } from '@/lib/config';
import { parseSettingList, type Setting } from '@/lib/setting';

const QUERY_KEY = ['hub_favorites'] as const;
const SYSTEM_GROUP = '__system';
const SYSTEM_TYPE = 'hub_favorites';

function findRecord(list: Setting[]): Setting | null {
  return (
    list.find(
      (s) => s.group.trim() === SYSTEM_GROUP && s.type.trim() === SYSTEM_TYPE,
    ) ?? null
  );
}

function parseIds(record: Setting | null): string[] {
  if (!record?.config1) return [];
  try {
    const arr = JSON.parse(record.config1);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'string');
  } catch {
    /* ignore */
  }
  return [];
}

async function fetchFavorites(): Promise<{ ids: string[]; recordId: string | null }> {
  const raw = await fetchJson<unknown>(API.CONFIGS);
  const list = parseSettingList(raw);
  const record = findRecord(list);
  const ids = parseIds(record);
  return { ids, recordId: record?.id ?? null };
}

export function useHubFavorites() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFavorites,
    staleTime: 60_000,
  });
}

export function useSaveHubFavorites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      recordId,
    }: {
      ids: string[];
      recordId: string | null;
    }) => {
      const body = {
        name: '',
        description: '',
        group: SYSTEM_GROUP,
        type: SYSTEM_TYPE,
        config1: JSON.stringify(ids),
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

/** Group ẩn — Setting UI sẽ filter nhóm này ra khỏi list. */
export const SYSTEM_GROUP_NAME = SYSTEM_GROUP;