import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import { API } from '@/lib/config';
import { parseNotes } from '@/schemas/note';
import { noteToMovie, movieToPayload, type Movie } from '@/lib/movies';
import { optimisticList } from '@/lib/optimistic';

// ============================================================
// Movies API hooks — Optimistic UI
// ============================================================

async function fetchMovies(): Promise<Movie[]> {
  const records = await fetchJson<unknown[]>(API.NOTES);
  const notes = parseNotes(records);
  return notes.map(noteToMovie).filter((m): m is Movie => m !== null);
}

export function useMovies() {
  return useQuery({ queryKey: ['movies'], queryFn: fetchMovies });
}

export function useCreateMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (movie: Omit<Movie, 'id'>) => {
      const now = new Date().toISOString();
      return fetchJson(API.NOTES, {
        method: 'POST',
        body: JSON.stringify({ ...movieToPayload({ ...movie, id: '' }), createdAt: now, updatedAt: now }),
      });
    },
    ...optimisticList<Movie[], Omit<Movie, 'id'>>(qc, ['movies'], (old, movie) => [
      { ...movie, id: 'temp_' + Date.now() },
      ...old,
    ]),
  });
}

export function useUpdateMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (movie: Movie) => {
      return fetchJson(`${API.NOTES}/${movie.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...movieToPayload(movie), updatedAt: new Date().toISOString() }),
      });
    },
    ...optimisticList<Movie[], Movie>(qc, ['movies'], (old, movie) =>
      old.map((m) => (m.id === movie.id ? movie : m)),
    ),
  });
}

export function useDeleteMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson(`${API.NOTES}/${id}`, { method: 'DELETE' });
    },
    ...optimisticList<Movie[], string>(qc, ['movies'], (old, id) =>
      old.filter((m) => m.id !== id),
    ),
  });
}
