// =============================================================
// PDF in-book search
// =============================================================
//
// Strategy: lazy index — lần search đầu tiên duyệt từng page, gọi
// `page.getTextContent()` rồi join thành string per-page. Cache lại
// trong WeakMap theo PDFDocumentProxy. Lần search sau dùng cache.
//
// Ưu điểm: open book không tốn gì; chỉ trả phí khi user mở Search tab.
// Sách 500 trang ~50ms để build text cache.

interface PdfDoc {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
}
interface PdfPage {
  getTextContent: () => Promise<{ items: Array<{ str?: unknown }> }>;
}

const cache = new WeakMap<object, string[]>();

export interface PdfSearchMatch {
  /** 1-based page number */
  page: number;
  /** Đoạn text quanh match để hiển thị (kèm context ~30 ký tự mỗi bên) */
  preview: string;
  /** Vị trí match trong page text — để tô đậm */
  highlightStart: number;
  highlightEnd: number;
}

async function buildIndex(doc: PdfDoc): Promise<string[]> {
  const cached = cache.get(doc as unknown as object);
  if (cached) return cached;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => (typeof it.str === 'string' ? it.str : ''))
        .join(' ');
      pages.push(text);
    } catch {
      pages.push('');
    }
  }
  cache.set(doc as unknown as object, pages);
  return pages;
}

export async function searchPdf(
  doc: unknown,
  query: string,
  opts: { limit?: number; caseSensitive?: boolean } = {},
): Promise<PdfSearchMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const pages = await buildIndex(doc as PdfDoc);
  const limit = opts.limit ?? 100;
  const matches: PdfSearchMatch[] = [];
  const needle = opts.caseSensitive ? q : q.toLowerCase();
  const ctx = 40;

  for (let i = 0; i < pages.length; i++) {
    if (matches.length >= limit) break;
    const text = pages[i];
    const haystack = opts.caseSensitive ? text : text.toLowerCase();
    let from = 0;
    while (matches.length < limit) {
      const idx = haystack.indexOf(needle, from);
      if (idx === -1) break;
      const start = Math.max(0, idx - ctx);
      const end = Math.min(text.length, idx + q.length + ctx);
      const preview = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
      matches.push({
        page: i + 1,
        preview,
        highlightStart: idx - start + (start > 0 ? 1 : 0),
        highlightEnd: idx - start + q.length + (start > 0 ? 1 : 0),
      });
      from = idx + needle.length;
    }
  }
  return matches;
}

/** Clear cache khi unmount reader (tránh giữ ref tới PDFDocumentProxy đã destroy) */
export function clearPdfSearchCache(doc: unknown) {
  cache.delete(doc as unknown as object);
}