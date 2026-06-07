import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import { API } from '@/lib/config';
import type { KeycapInventory } from '@/lib/keycap/types';
import { reallocateAllLots } from '@/lib/keycap/lotMath';
import { incrementPending, decrementPending } from '@/lib/optimistic';

// ============================================================
// Keycap inventory API hooks — Optimistic UI
// ============================================================

const KEYCAP_TYPE = 'keycap_inventory';
const KEYCAP_TITLE = '__keycap_inventory__';

interface RawNote { id: string; type?: string; content?: string; }

interface InventoryWithMeta {
  recordId: string | null;
  inventory: KeycapInventory;
}

const EMPTY_INVENTORY: KeycapInventory = { items: [], lots: [], groups: [] };

async function fetchKeycap(): Promise<InventoryWithMeta> {
  const records = await fetchJson<RawNote[]>(API.NOTES);
  const record = records.find((r) => r.type === KEYCAP_TYPE);
  if (!record) return { recordId: null, inventory: EMPTY_INVENTORY };
  let parsed: KeycapInventory = EMPTY_INVENTORY;
  try {
    const content = JSON.parse(record.content ?? '{}');
    if (Array.isArray(content)) {
      parsed = { items: content, lots: [], groups: [] };
    } else {
      parsed = { items: content.items ?? [], lots: content.lots ?? [], groups: content.groups ?? [] };
    }
  } catch { /* ignore */ }
  return { recordId: record.id, inventory: parsed };
}

export function useKeycap() {
  return useQuery({ queryKey: ['keycap'], queryFn: fetchKeycap });
}

interface SaveInput {
  recordId: string | null;
  inventory: KeycapInventory;
}

async function saveInventory({ recordId, inventory }: SaveInput): Promise<RawNote> {
  const items = reallocateAllLots(inventory.items, inventory.lots);
  const finalInventory = { ...inventory, items };
  const body = {
    type: KEYCAP_TYPE,
    title: KEYCAP_TITLE,
    content: JSON.stringify(finalInventory),
    source: '',
    tags: '',
    url1: '',
    url2: '',
  };
  if (recordId) {
    return fetchJson<RawNote>(`${API.NOTES}/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...body, updatedAt: new Date().toISOString() }),
    });
  }
  return fetchJson<RawNote>(API.NOTES, {
    method: 'POST',
    body: JSON.stringify({ ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
  });
}

export function useSaveKeycap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveInventory,
    onMutate: async (input) => {
      incrementPending();
      await qc.cancelQueries({ queryKey: ['keycap'] });
      const snapshot = qc.getQueryData<InventoryWithMeta>(['keycap']);
      // Optimistic: update cache ngay với inventory mới (re-allocate client-side)
      const items = reallocateAllLots(input.inventory.items, input.inventory.lots);
      qc.setQueryData<InventoryWithMeta>(['keycap'], {
        recordId: input.recordId,
        inventory: { ...input.inventory, items },
      });
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.snapshot !== undefined) qc.setQueryData(['keycap'], ctx.snapshot);
    },
    onSettled: (data) => {
      decrementPending();
      // Cập nhật recordId nếu là POST lần đầu
      if (data?.id) {
        const current = qc.getQueryData<InventoryWithMeta>(['keycap']);
        if (current && !current.recordId) {
          qc.setQueryData(['keycap'], { ...current, recordId: data.id });
        }
      }
      qc.invalidateQueries({ queryKey: ['keycap'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
