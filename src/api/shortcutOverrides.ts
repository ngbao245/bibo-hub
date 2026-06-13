
// ============================================================
// Shortcut Overrides — config shortcut từ /Config
// ============================================================
//
// 1 record: group="Setting", type="Shortcut".
// config1 = JSON { [shortcutId]: { key: string, enabled: boolean } }
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import { API } from '@/lib/config';
import { parseSettingList, type Setting } from '@/lib/setting';

const QUERY_KEY = ['shortcut_overrides'] as const;
const SC_GROUP = 'Setting';
const SC_TYPE = 'Shortcut';

export interface ShortcutOverride {
  key: string;
  enabled: boolean;
}

export type ShortcutOverridesData = Record<string, ShortcutOverride>;

const EMPTY: ShortcutOverridesData = {};

function findRecord(list: Setting[]): Setting | null {
  return (
    list.find(
      (s) => s.group.trim() === SC_GROUP && s.type.trim() === SC_TYPE,
    ) ?? null
  );
}

function parseData(record: Setting | null): ShortcutOverridesData {
  if (!record?.config1) return EMPTY;
  try {
    const obj = JSON.parse(record.config1);
    if (obj && typeof obj === 'object') {
      const out: ShortcutOverridesData = {};
      for (const [id, val] of Object.entries(obj)) {
        if (
          val &&
          typeof val === 'object' &&
          typeof (val as ShortcutOverride).key === 'string' &&
          typeof (val as ShortcutOverride).enabled === 'boolean'
        ) {
          out[id] = val as ShortcutOverride;
        }
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return EMPTY;
}

async function fetchShortcutOverrides(): Promise<{
  data: ShortcutOverridesData;
  recordId: string | null;
}> {
  const raw = await fetchJson<unknown>(API.CONFIGS);
  const list = parseSettingList(raw);
  const record = findRecord(list);
  return { data: parseData(record), recordId: record?.id ?? null };
}

export function useShortcutOverrides() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchShortcutOverrides,
    staleTime: 60_000,
  });
}

export function useSaveShortcutOverrides() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      data,
      recordId,
    }: {
      data: ShortcutOverridesData;
      recordId: string | null;
    }) => {
      const body = {
        name: '',
        description: '',
        group: SC_GROUP,
        type: SC_TYPE,
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