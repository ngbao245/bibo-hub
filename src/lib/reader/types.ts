export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  file_url: string;
  file_path: string;
  /** Giữ field cho backward-compat schema, luôn là 'pdf' */
  format: 'pdf';
  created_at: string;
}

export interface ReadingProgress {
  id: string;
  user_id: string;
  book_id: string;
  /** PDF page number as string. */
  location: string | null;
  /** 0..1 */
  progress: number;
  updated_at: string;
}

export interface HighlightLocation {
  type: 'pdf';
  page: number;
  rects: Array<{ x: number; y: number; w: number; h: number }>;
}

export interface Highlight {
  id: string;
  book_id: string;
  user_id: string;
  location: HighlightLocation;
  /** Legacy column kept for backward-compat reads (ignored for PDF) */
  cfi_range: string | null;
  text: string;
  note: string | null;
  color: string;
  created_at: string;
}