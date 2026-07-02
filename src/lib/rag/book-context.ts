// ============================================================
// Book context extraction — text plain quanh trang hiện tại
// ============================================================
//
// Phase 4 approach (ephemeral, không vector hóa):
//   User đang đọc trang N → hỏi câu Y
//   → extract text plain trang [N-window .. N+window]
//   → format thành prompt context
//   → gửi Gemini chat
//   → AI cite [p.X], click jumps tới trang X
//
// Không embed, không Supabase, không persist. Gemini 2.5 Flash context
// 1M token thoải mái cho 21 trang (~8k token).
//
// Cache extracted text trong WeakMap theo PDFDocumentProxy để hỏi nhiều
// câu liền không extract lại.
// ============================================================

interface PdfPage {
  getTextContent: () => Promise<{
    items: Array<{ str?: unknown }>;
  }>;
}

interface PdfDoc {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
}

// In-memory cache: WeakMap để GC tự dọn khi PDFDocumentProxy bị destroy.
// Map page → text. Build lazy, mỗi trang chỉ extract 1 lần per session.
const pageTextCache = new WeakMap<object, Map<number, string>>();

/**
 * Extract text plain của 1 trang PDF. Cache result trong WeakMap.
 *
 * Throw nếu trang không tồn tại hoặc PDF.js fail.
 */
async function extractPageText(doc: PdfDoc, page: number): Promise<string> {
  const docKey = doc as unknown as object;
  let cache = pageTextCache.get(docKey);
  if (!cache) {
    cache = new Map();
    pageTextCache.set(docKey, cache);
  }
  const hit = cache.get(page);
  if (hit !== undefined) return hit;

  try {
    const p = await doc.getPage(page);
    const content = await p.getTextContent();
    const text = content.items
      .map((it) => (typeof it.str === 'string' ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    cache.set(page, text);
    return text;
  } catch {
    cache.set(page, '');
    return '';
  }
}

export interface BookContextPage {
  page: number;
  text: string;
}

export interface BookContextResult {
  /** Trang hiện tại (1-based). */
  currentPage: number;
  /** Trang đầu của window thực tế (sau khi clamp). */
  fromPage: number;
  /** Trang cuối của window thực tế (sau khi clamp). */
  toPage: number;
  /** Array trang với text. Có thể có trang rỗng (PDF scan thuần ảnh). */
  pages: BookContextPage[];
  /** Tổng số ký tự text gộp lại. UI dùng để hiển thị size. */
  totalChars: number;
}

/**
 * Extract text của trang hiện tại + window trang trước/sau.
 *
 * Window mặc định 10 (= 21 trang tổng). Clamp về [1, numPages].
 * Trang không extract được → text rỗng nhưng vẫn giữ trong array.
 *
 * Extract parallel qua Promise.all — pdfjs đã có cache page nội bộ nên
 * gọi nhiều trang đồng thời an toàn, không phá perf reader.
 */
export async function extractBookContext(
  doc: PdfDoc,
  currentPage: number,
  windowSize: number = 10,
): Promise<BookContextResult> {
  const total = doc.numPages;
  const from = Math.max(1, currentPage - windowSize);
  const to = Math.min(total, currentPage + windowSize);

  const pageNums: number[] = [];
  for (let p = from; p <= to; p++) pageNums.push(p);

  const texts = await Promise.all(
    pageNums.map(async (p) => ({ page: p, text: await extractPageText(doc, p) })),
  );

  const totalChars = texts.reduce((sum, t) => sum + t.text.length, 0);

  return {
    currentPage,
    fromPage: from,
    toPage: to,
    pages: texts,
    totalChars,
  };
}

/**
 * Format BookContextResult thành string cho prompt.
 *
 * Format:
 *   === Trang 32 ===
 *   {text}
 *
 *   === Trang 33 ===
 *   {text}
 *
 * Trang rỗng bị skip để không bloat token.
 */
export function formatBookContext(ctx: BookContextResult): string {
  return ctx.pages
    .filter((p) => p.text.length > 0)
    .map((p) => `=== Trang ${p.page} ===\n${p.text}`)
    .join('\n\n');
}

/**
 * Clear cache text của 1 PDF doc cụ thể. Gọi khi unmount reader để giải
 * phóng memory sớm (WeakMap cũng tự dọn nhưng explicit cho chắc).
 */
export function clearBookContextCache(doc: unknown): void {
  pageTextCache.delete(doc as object);
}