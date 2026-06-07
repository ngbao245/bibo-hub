import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import { API } from '@/lib/config';
import { parseExpenseContent, type ExpenseDay, type ExpenseItem } from '@/lib/expense';
import { optimisticList } from '@/lib/optimistic';

// ============================================================
// Expense API hooks — Optimistic UI
// ============================================================

interface RawNote {
  id: string;
  type?: string;
  source?: string;
  title?: string;
  content?: string;
}

async function fetchExpenses(): Promise<ExpenseDay[]> {
  const records = await fetchJson<RawNote[]>(API.NOTES);
  return records
    .filter((r) => r.type === 'expense')
    .map((r): ExpenseDay => ({
      date: r.source ?? '',
      recordId: r.id,
      items: parseExpenseContent(r.content),
    }))
    .filter((d) => d.date)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function useExpenses() {
  return useQuery({ queryKey: ['expenses'], queryFn: fetchExpenses });
}

// ============================================================
// Save day helper (internal)
// ============================================================
async function saveDay(date: string, recordId: string | null, items: ExpenseItem[]): Promise<RawNote> {
  const body = {
    type: 'expense',
    title: date,
    source: date,
    content: JSON.stringify(items),
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

// ============================================================
// Mutations
// ============================================================

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; item: ExpenseItem }) => {
      const days = qc.getQueryData<ExpenseDay[]>(['expenses']) ?? [];
      const day = days.find((d) => d.date === input.date);
      const items = day ? [...day.items, input.item] : [input.item];
      return saveDay(input.date, day?.recordId ?? null, items);
    },
    ...optimisticList<ExpenseDay[], { date: string; item: ExpenseItem }>(
      qc,
      ['expenses'],
      (old, input) => {
        const existing = old.find((d) => d.date === input.date);
        if (existing) {
          return old.map((d) =>
            d.date === input.date ? { ...d, items: [...d.items, input.item] } : d,
          );
        }
        return [{ date: input.date, recordId: null, items: [input.item] }, ...old];
      },
    ),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; itemId: string }) => {
      const days = qc.getQueryData<ExpenseDay[]>(['expenses']) ?? [];
      const day = days.find((d) => d.date === input.date);
      if (!day) return null;
      const items = day.items.filter((it) => it.id !== input.itemId);
      if (items.length === 0 && day.recordId) {
        await fetchJson(`${API.NOTES}/${day.recordId}`, { method: 'DELETE' });
        return null;
      }
      return saveDay(input.date, day.recordId, items);
    },
    ...optimisticList<ExpenseDay[], { date: string; itemId: string }>(
      qc,
      ['expenses'],
      (old, input) =>
        old
          .map((d) =>
            d.date === input.date
              ? { ...d, items: d.items.filter((it) => it.id !== input.itemId) }
              : d,
          )
          .filter((d) => d.items.length > 0),
    ),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; item: ExpenseItem }) => {
      const days = qc.getQueryData<ExpenseDay[]>(['expenses']) ?? [];
      const day = days.find((d) => d.date === input.date);
      if (!day) return null;
      const items = day.items.map((it) => (it.id === input.item.id ? input.item : it));
      return saveDay(input.date, day.recordId, items);
    },
    ...optimisticList<ExpenseDay[], { date: string; item: ExpenseItem }>(
      qc,
      ['expenses'],
      (old, input) =>
        old.map((d) =>
          d.date === input.date
            ? { ...d, items: d.items.map((it) => (it.id === input.item.id ? input.item : it)) }
            : d,
        ),
    ),
  });
}
