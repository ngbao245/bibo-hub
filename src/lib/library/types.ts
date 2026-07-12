export interface Book {
  id: string;
  /** UUID của user upload — audit only, không dùng lọc quyền */
  uploaded_by_id: string;
  /** Username của người upload, hiển thị dưới cover. NULL với data cũ */
  uploaded_by: string | null;
  title: string;
  author: string | null;
  cover_url: string | null;
  file_url: string;
  file_path: string;
  /** Giữ field cho backward-compat schema, luôn là 'pdf' */
  format: 'pdf';
  created_at: string;
  /** Số lần sách được mở đọc (increment mỗi lần Reader mount). */
  view_count: number;
  /** Dung lượng file PDF (bytes). NULL nếu chưa backfill (sách upload trước feature). */
  file_size_bytes: number | null;
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