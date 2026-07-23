import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/api/client';
import { API } from '@/lib/config';
import { parseNotes, type Note } from '@/schemas/note';
import { optimisticList } from '@/lib/optimistic';

// ============================================================
// Sources API — MockAPI (chưa migrate)
// ============================================================
//
// Sources lưu trong MockAPI endpoint API.NOTES với type='source'.
// Tách riêng khỏi useNotes (đã migrate sang workspace) để tránh
// mismatch read/write.
// ============================================================

const SOURCES_KEY = ['sources'] as const;

async function fetchSources(): Promise<Note[]> {
  const raw = await fetchJson<unknown[]>(API.NOTES);
  return parseNotes(raw).filter((n) => n.type === 'source');
}

export function useSources() {
  return useQuery({ queryKey: SOURCES_KEY, queryFn: fetchSources });
}

// ============================================================
// Mutations
// ============================================================

export interface SourceInput {
  title: string;
  content?: string;
  source?: string | null;
  tags?: string | null;
  url1?: string | null;
  url2?: string | null;
  url3?: string | null;
  url4?: string | null;
  url5?: string | null;
}

export function useCreateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SourceInput) => {
      const now = new Date().toISOString();
      const body = {
        type: 'source',
        title: input.title,
        content: input.content ?? '',
        source: input.source ?? null,
        tags: input.tags ?? null,
        url1: input.url1 ?? null,
        url2: input.url2 ?? null,
        url3: input.url3 ?? null,
        url4: input.url4 ?? null,
        url5: input.url5 ?? null,
        createdAt: now,
        updatedAt: now,
      };
      const created = await fetchJson<unknown>(API.NOTES, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const parsed = parseNotes([created]);
      return parsed[0] ?? ({ ...body, id: String(Date.now()) } as unknown as Note);
    },
    ...optimisticList<Note[], SourceInput>(qc, SOURCES_KEY, (old, input) => {
      const temp: Note = {
        id: 'temp_' + Date.now(),
        title: input.title,
        content: input.content ?? '',
        type: 'source',
        source: input.source ?? null,
        tags: input.tags ?? null,
        example: null,
        url1: input.url1 ?? null,
        url2: input.url2 ?? null,
        url3: input.url3 ?? null,
        url4: input.url4 ?? null,
        url5: input.url5 ?? null,
        wordCountEnabled: null,
        timerDuration: null,
        linkedNotes: [],
        isChildNote: false,
        parentNoteId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return [temp, ...old];
    }),
  });
}

export function useUpdateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: Note) => {
      const body = {
        title: note.title,
        content: note.content,
        source: note.source,
        tags: note.tags,
        url1: note.url1,
        url2: note.url2,
        url3: note.url3,
        url4: note.url4,
        url5: note.url5,
        updatedAt: new Date().toISOString(),
      };
      await fetchJson(`${API.NOTES}/${note.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return note;
    },
    ...optimisticList<Note[], Note>(qc, SOURCES_KEY, (old, note) =>
      old.map((n) => (n.id === note.id ? { ...note, updatedAt: new Date().toISOString() } : n)),
    ),
  });
}

export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await fetchJson(`${API.NOTES}/${id}`, { method: 'DELETE' });
    },
    ...optimisticList<Note[], string>(qc, SOURCES_KEY, (old, id) =>
      old.filter((n) => n.id !== id),
    ),
  });
}