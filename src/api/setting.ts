
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import { API } from '@/lib/config';
import { optimisticList } from '@/lib/optimistic';
import {
  parseSetting,
  parseSettingList,
  type Setting,
  type SettingInput,
} from '@/lib/setting';

// ============================================================
// Setting API hooks — Optimistic UI
// ============================================================
//
// Resource: /Config trên mockapi (CONFIG_BASE riêng).
// Schema: { id, name, description, avatar, config1..config10 } (toàn string).
// ============================================================

const QUERY_KEY = ['settings'] as const;

async function fetchSettings(): Promise<Setting[]> {
  const raw = await fetchJson<unknown>(API.CONFIGS);
  return parseSettingList(raw);
}

export function useSettings() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchSettings });
}

export function useCreateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SettingInput) => {
      const raw = await fetchJson<unknown>(API.CONFIGS, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return parseSetting(raw);
    },
    ...optimisticList<Setting[], SettingInput>(qc, QUERY_KEY, (old, input) => [
      { ...input, id: 'temp_' + Date.now() },
      ...old,
    ]),
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (setting: Setting) => {
      const { id, ...payload } = setting;
      const raw = await fetchJson<unknown>(`${API.CONFIGS}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return parseSetting(raw);
    },
    ...optimisticList<Setting[], Setting>(qc, QUERY_KEY, (old, c) =>
      old.map((x) => (x.id === c.id ? c : x)),
    ),
  });
}

export function useDeleteSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson(`${API.CONFIGS}/${id}`, { method: 'DELETE' });
    },
    ...optimisticList<Setting[], string>(qc, QUERY_KEY, (old, id) =>
      old.filter((c) => c.id !== id),
    ),
  });
}