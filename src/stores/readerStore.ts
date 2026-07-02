// ============================================================
// Reader store — chia sẻ doc + currentPage cho module khác (RAG)
// ============================================================
//
// Tại sao phải có store:
//   PdfReader giữ pdfjs Document trong useRef nội bộ, không expose ra ngoài.
//   Module RAG (ChatTab) cần biết user đang đọc trang nào của sách nào
//   để extract book context cho prompt → cần shared state nhẹ.
//
// Pattern:
//   - PdfReader.onLoadSuccess → setReader({ doc, bookId, bookTitle, numPages })
//   - PdfReader effect[pageNumber] → setPage(pageNumber)
//   - PdfReader unmount → clear()
//   - ChatTab dùng useReaderStore.getState() khi gửi message (snapshot,
//     không subscribe → tránh re-render thừa).
//
// Chỉ giữ minimal — không cache page text ở đây (book-context.ts WeakMap
// đã lo). Doc bị null sau unmount → button "Sách" trong ChatTab tự disable.
// ============================================================

import { create } from 'zustand';

// Subset của PDFDocumentProxy đủ cho extractBookContext + EBP types.
// Match shape mà book-context.ts khai báo.
export interface PdfDocLike {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: Array<{ str?: unknown }> }>;
  }>;
}

interface ReaderState {
  /** PDFDocumentProxy đang mở. null khi không có reader nào active. */
  doc: PdfDocLike | null;
  /** Book id từ Supabase. Dùng cho navigation citation [p.X]. */
  bookId: string | null;
  /** Title để hiển thị badge trong chat. */
  bookTitle: string;
  /** Trang hiện tại (1-based). */
  currentPage: number;
  /** Tổng số trang — cho UI nếu cần. */
  numPages: number;

  setReader: (data: {
    doc: PdfDocLike;
    bookId: string;
    bookTitle: string;
    numPages: number;
  }) => void;
  setPage: (page: number) => void;
  clear: () => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  doc: null,
  bookId: null,
  bookTitle: '',
  currentPage: 1,
  numPages: 0,
  setReader: ({ doc, bookId, bookTitle, numPages }) =>
    set({ doc, bookId, bookTitle, numPages }),
  setPage: (currentPage) => set({ currentPage }),
  clear: () =>
    set({
      doc: null,
      bookId: null,
      bookTitle: '',
      currentPage: 1,
      numPages: 0,
    }),
}));

/** Selector — có reader đang mở và hợp lệ để chat book mode? */
export const selectHasReader = (s: ReaderState): boolean =>
  s.doc !== null && s.bookId !== null;