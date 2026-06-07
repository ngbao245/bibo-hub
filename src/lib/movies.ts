import type { Note } from '@/schemas/note';

// ============================================================
// Movies types & helpers
// ============================================================
//
// V1 lưu phim trong table `notes` với type='movie'|'series'.
// Field mapping:
//   title    → tên phim
//   content  → ghi chú
//   tags     → status: 'watching' | 'completed' | 'plan'
//   source   → URL xem phim
//   url1     → currentTime (movie) | currentEpisode (series)
//   url2     → totalTime  (movie) | totalEpisodes  (series)
//   url3     → season (series only)
//   url4     → rating 1-5
//   url5     → episodeDuration (series, time trong tập hiện tại)
// ============================================================

export type MovieType = 'movie' | 'series';
export type MovieStatus = 'watching' | 'completed' | 'plan';

export interface Movie {
  id: string;
  title: string;
  type: MovieType;
  status: MovieStatus;
  notes: string;
  watchUrl: string;
  rating: number; // 0-5

  // Movie fields
  currentTime: string; // "MM:SS" or "HH:MM:SS"
  totalTime: string;

  // Series fields
  season: number;
  currentEpisode: number;
  totalEpisodes: number;
}

const STATUSES: MovieStatus[] = ['watching', 'completed', 'plan'];

/** Parse Note → Movie. Trả null nếu không phải movie/series. */
export function noteToMovie(note: Note): Movie | null {
  if (note.type !== 'movie' && note.type !== 'series') return null;

  const status = STATUSES.includes(note.tags as MovieStatus)
    ? (note.tags as MovieStatus)
    : 'plan';

  return {
    id: note.id,
    title: note.title,
    type: note.type,
    status,
    notes: note.content,
    watchUrl: note.source ?? '',
    rating: parseInt(note.url4 ?? '0', 10) || 0,
    currentTime: note.type === 'movie' ? note.url1 ?? '0:00' : '0:00',
    totalTime: note.type === 'movie' ? note.url2 ?? '0:00' : '0:00',
    season: note.type === 'series' ? parseInt(note.url3 ?? '1', 10) || 1 : 1,
    currentEpisode: note.type === 'series' ? parseInt(note.url1 ?? '0', 10) || 0 : 0,
    totalEpisodes: note.type === 'series' ? parseInt(note.url2 ?? '0', 10) || 0 : 0,
  };
}

/** Build payload từ Movie để PUT/POST notes API */
export function movieToPayload(movie: Movie): Record<string, unknown> {
  if (movie.type === 'movie') {
    return {
      type: 'movie',
      title: movie.title,
      content: movie.notes,
      source: movie.watchUrl,
      tags: movie.status,
      url1: movie.currentTime,
      url2: movie.totalTime,
      url3: '',
      url4: String(movie.rating),
      url5: '',
    };
  }
  // series
  return {
    type: 'series',
    title: movie.title,
    content: movie.notes,
    source: movie.watchUrl,
    tags: movie.status,
    url1: String(movie.currentEpisode),
    url2: String(movie.totalEpisodes),
    url3: String(movie.season),
    url4: String(movie.rating),
    url5: '',
  };
}

// ============================================================
// Time helpers
// ============================================================

/** "120" → 120 (giây), "12:34" → 754, "1:12:34" → 4354 */
export function timeToSeconds(time: string): number {
  if (!time) return 0;
  const parts = time.split(':').map((p) => parseInt(p, 10) || 0);
  if (parts.length === 1) return parts[0] * 60; // chỉ phút
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/** 754 → "12:34" */
export function secondsToTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Smart parse user input: "120" → "120:00", "12 34" → "12:34" */
export function parseTimeInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '0:00';
  if (trimmed.includes(':')) return trimmed;
  if (trimmed.includes(' ')) {
    return trimmed.split(/\s+/).join(':');
  }
  // chỉ có 1 số → coi là phút
  return `${trimmed}:00`;
}

// ============================================================
// Progress
// ============================================================

export function calculateProgress(movie: Movie): number {
  if (movie.type === 'movie') {
    const total = timeToSeconds(movie.totalTime);
    if (total <= 0) return 0;
    return Math.min(100, (timeToSeconds(movie.currentTime) / total) * 100);
  }
  // series
  if (movie.totalEpisodes <= 0) return 0;
  return Math.min(100, (movie.currentEpisode / movie.totalEpisodes) * 100);
}

/** Auto-detect status từ progress */
export function autoStatus(movie: Movie): MovieStatus {
  if (movie.type === 'movie') {
    const cur = timeToSeconds(movie.currentTime);
    const total = timeToSeconds(movie.totalTime);
    if (total > 0 && cur >= total) return 'completed';
    if (cur > 0) return 'watching';
    return 'plan';
  }
  if (movie.totalEpisodes > 0 && movie.currentEpisode >= movie.totalEpisodes) {
    return 'completed';
  }
  if (movie.currentEpisode > 0) return 'watching';
  return 'plan';
}
