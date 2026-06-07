import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import { API } from '@/lib/config';
import { parseSavingsGoal, toSavingsPayload, type SavingsGoal } from '@/lib/savings';
import { incrementPending, decrementPending } from '@/lib/optimistic';

// ============================================================
// Savings API hooks — Optimistic UI
// ============================================================

interface RawNote { id: string; type?: string; content?: string; url1?: string; url2?: string; url3?: string; url4?: string; createdAt?: string; }

async function fetchSavings(): Promise<SavingsGoal | null> {
  const records = await fetchJson<RawNote[]>(API.NOTES);
  const r = records.find((r) => r.type === 'savings');
  if (!r) return null;
  return parseSavingsGoal(r as unknown as Record<string, unknown>);
}

export function useSavings() {
  return useQuery({ queryKey: ['savings'], queryFn: fetchSavings });
}

export function useCreateSavings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: Omit<SavingsGoal, 'id'>) => {
      const now = new Date().toISOString();
      return fetchJson<RawNote>(API.NOTES, {
        method: 'POST',
        body: JSON.stringify({ ...toSavingsPayload({ ...goal, id: '' }), createdAt: goal.startDate ?? now, updatedAt: now }),
      });
    },
    onMutate: async (goal) => {
      incrementPending();
      await qc.cancelQueries({ queryKey: ['savings'] });
      const snapshot = qc.getQueryData<SavingsGoal | null>(['savings']);
      qc.setQueryData(['savings'], { ...goal, id: 'temp_' + Date.now() } as SavingsGoal);
      return { snapshot };
    },
    onError: (_e, _v, ctx) => { if (ctx?.snapshot !== undefined) qc.setQueryData(['savings'], ctx.snapshot); },
    onSettled: () => { decrementPending(); qc.invalidateQueries({ queryKey: ['savings'] }); },
  });
}

export function useUpdateSavings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: SavingsGoal) => {
      return fetchJson<RawNote>(`${API.NOTES}/${goal.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...toSavingsPayload(goal), updatedAt: new Date().toISOString() }),
      });
    },
    onMutate: async (goal) => {
      incrementPending();
      await qc.cancelQueries({ queryKey: ['savings'] });
      const snapshot = qc.getQueryData<SavingsGoal | null>(['savings']);
      qc.setQueryData<SavingsGoal | null>(['savings'], goal);
      return { snapshot };
    },
    onError: (_e, _v, ctx) => { if (ctx?.snapshot !== undefined) qc.setQueryData(['savings'], ctx.snapshot); },
    onSettled: () => { decrementPending(); qc.invalidateQueries({ queryKey: ['savings'] }); },
  });
}

export function useDeleteSavings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson(`${API.NOTES}/${id}`, { method: 'DELETE' });
    },
    onMutate: async () => {
      incrementPending();
      await qc.cancelQueries({ queryKey: ['savings'] });
      const snapshot = qc.getQueryData<SavingsGoal | null>(['savings']);
      qc.setQueryData<SavingsGoal | null>(['savings'], null);
      return { snapshot };
    },
    onError: (_e, _v, ctx) => { if (ctx?.snapshot !== undefined) qc.setQueryData(['savings'], ctx.snapshot); },
    onSettled: () => { decrementPending(); qc.invalidateQueries({ queryKey: ['savings'] }); },
  });
}
