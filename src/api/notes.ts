import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import { API } from '@/lib/config';
import { parseNotes, type Note, type NoteType } from '@/schemas/note';
import { optimisticList } from '@/lib/optimistic';

// ============================================================
// Notes API hooks — Optimistic UI
// ============================================================

async function fetchNotes(): Promise<Note[]> {
  const records = await fetchJson<unknown[]>(API.NOTES);
  return parseNotes(records);
}

export function useNotes() {
  return useQuery({ queryKey: ['notes'], queryFn: fetchNotes });
}

// ============================================================
// Mutations
// ============================================================

export interface NoteInput {
  title: string;
  content?: string;
  type?: NoteType;
  source?: string | null;
  tags?: string | null;
  example?: string | null;
  url1?: string | null;
  url2?: string | null;
  url3?: string | null;
  url4?: string | null;
  url5?: string | null;
  // Linked / child notes
  linkedNotes?: string[];
  isChildNote?: boolean;
  parentNoteId?: string | null;
  // Editor state persistence
  wordCountEnabled?: boolean;
  timerDuration?: string | null;
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NoteInput) => {
      const now = new Date().toISOString();
      return fetchJson<Note>(API.NOTES, {
        method: 'POST',
        body: JSON.stringify({
          type: 'note',
          content: '',
          createdAt: now,
          updatedAt: now,
          ...input,
        }),
      });
    },
    ...optimisticList<Note[], NoteInput>(qc, ['notes'], (old, input) => {
      const temp: Note = {
        id: 'temp_' + Date.now(),
        title: input.title,
        content: input.content ?? '',
        type: input.type ?? 'note',
        source: input.source ?? null,
        tags: input.tags ?? null,
        example: input.example ?? null,
        url1: input.url1 ?? null,
        url2: input.url2 ?? null,
        url3: input.url3 ?? null,
        url4: input.url4 ?? null,
        url5: input.url5 ?? null,
        wordCountEnabled: input.wordCountEnabled ?? null,
        timerDuration: input.timerDuration ?? null,
        linkedNotes: input.linkedNotes ?? [],
        isChildNote: input.isChildNote ?? false,
        parentNoteId: input.parentNoteId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return [temp, ...old];
    }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: Note) => {
      return fetchJson<Note>(`${API.NOTES}/${note.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...note, updatedAt: new Date().toISOString() }),
      });
    },
    ...optimisticList<Note[], Note>(qc, ['notes'], (old, note) =>
      old.map((n) => (n.id === note.id ? { ...note, updatedAt: new Date().toISOString() } : n)),
    ),
  });
}

// ============================================================
// Delete với cascade:
// - Nếu note có linkedNotes là child note → DELETE child notes đó
// - Xoá id ra khỏi linkedNotes của các note khác đang reference tới
// ============================================================
export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const all = qc.getQueryData<Note[]>(['notes']) ?? [];
      const target = all.find((n) => n.id === id);
      if (!target) {
        return fetchJson(`${API.NOTES}/${id}`, { method: 'DELETE' });
      }

      // 1. Xoá child notes (nếu có)
      const childNoteIds = (target.linkedNotes ?? [])
        .map((linkedId) => all.find((n) => n.id === linkedId))
        .filter((n): n is Note => !!n && n.isChildNote)
        .map((n) => n.id);

      for (const childId of childNoteIds) {
        try {
          await fetchJson(`${API.NOTES}/${childId}`, { method: 'DELETE' });
        } catch (e) {
          console.warn('Cascade delete child note failed', childId, e);
        }
      }

      // 2. Update các notes đang reference tới target — gỡ id ra khỏi linkedNotes
      const referencing = all.filter(
        (n) =>
          n.id !== id &&
          !childNoteIds.includes(n.id) &&
          (n.linkedNotes ?? []).includes(id),
      );
      for (const ref of referencing) {
        try {
          const next: Note = {
            ...ref,
            linkedNotes: (ref.linkedNotes ?? []).filter((lid) => lid !== id),
            updatedAt: new Date().toISOString(),
          };
          await fetchJson(`${API.NOTES}/${ref.id}`, {
            method: 'PUT',
            body: JSON.stringify(next),
          });
        } catch (e) {
          console.warn('Update referencing note failed', ref.id, e);
        }
      }

      // 3. Nếu target là child note → gỡ id khỏi parent.linkedNotes
      if (target.isChildNote && target.parentNoteId) {
        const parent = all.find((n) => n.id === target.parentNoteId);
        if (parent) {
          try {
            const next: Note = {
              ...parent,
              linkedNotes: (parent.linkedNotes ?? []).filter((lid) => lid !== id),
              updatedAt: new Date().toISOString(),
            };
            await fetchJson(`${API.NOTES}/${parent.id}`, {
              method: 'PUT',
              body: JSON.stringify(next),
            });
          } catch (e) {
            console.warn('Update parent note failed', parent.id, e);
          }
        }
      }

      // 4. Xoá target
      return fetchJson(`${API.NOTES}/${id}`, { method: 'DELETE' });
    },
    ...optimisticList<Note[], string>(qc, ['notes'], (old, id) => {
      const target = old.find((n) => n.id === id);
      if (!target) return old.filter((n) => n.id !== id);

      // Lấy danh sách child note ids để cùng xoá khỏi cache
      const childIds = new Set(
        (target.linkedNotes ?? [])
          .map((linkedId) => old.find((n) => n.id === linkedId))
          .filter((n): n is Note => !!n && n.isChildNote)
          .map((n) => n.id),
      );

      return old
        .filter((n) => n.id !== id && !childIds.has(n.id))
        .map((n) =>
          (n.linkedNotes ?? []).includes(id)
            ? {
              ...n,
              linkedNotes: (n.linkedNotes ?? []).filter((lid) => lid !== id),
            }
            : n,
        );
    }),
  });
}
