// ============================================================
// RAG prompt templates — cho Phase 3 hybrid chat
// ============================================================
//
// 2 modes:
//   - Auto: tự quyết dùng context (notes) hay trả lời thuần LLM.
//   - Internal: ép dùng context, không có thì "không biết".
//
// Placeholder {context} sẽ được replace bằng formatted chunks.
// ============================================================

/** Auto mode: context liên quan (similarity >= threshold). */
export function promptAutoWithContext(context: string): string {
  return `Bạn là trợ lý cá nhân. User có ghi chú riêng dưới đây.
- Khi context liên quan câu hỏi: trả lời dựa trên đó, cite nguồn bằng [n].
- Khi context không liên quan hoặc thiếu: dùng kiến thức chung của bạn, KHÔNG cite.
- Khi kết hợp cả hai: nói rõ phần nào từ ghi chú, phần nào từ kiến thức chung.
- Trả lời bằng tiếng Việt trừ khi user yêu cầu khác.

Context:
${context}`;
}

/** Auto mode: không có context liên quan → LLM thuần. */
export const PROMPT_AUTO_NO_CONTEXT = `Bạn là trợ lý AI. Trả lời câu hỏi của user bằng kiến thức của bạn. Trả lời bằng tiếng Việt trừ khi user yêu cầu khác.`;

/** Internal mode: chỉ dùng context, không hallucinate. */
export function promptInternal(context: string): string {
  return `Bạn chỉ được trả lời dựa trên context dưới đây. Nếu context không đủ thông tin, trả lời "Tôi không tìm thấy thông tin trong ghi chú của bạn về vấn đề này."
Luôn cite nguồn bằng [n]. Trả lời bằng tiếng Việt trừ khi user yêu cầu khác.

Context:
${context}`;
}

// ============================================================
// Book context prompt (Phase 4 — Reader sidebar AI tab)
// ============================================================

/**
 * Reader AI tab: trả lời dựa trên text plain của trang hiện tại + window
 * trang trước/sau. KHÔNG vector search, KHÔNG cite [n] mà cite [p.X].
 */
export function promptBookContext(
  context: string,
  currentPage: number,
  fromPage: number,
  toPage: number,
): string {
  return `Bạn là trợ lý đọc sách. Người dùng đang đọc trang ${currentPage} của một cuốn sách.
Dưới đây là nội dung trang ${fromPage} đến trang ${toPage} (bao gồm trang hiện tại).

Quy tắc:
- Trả lời dựa trên context, ưu tiên thông tin gần trang ${currentPage}.
- Khi trích thông tin từ 1 trang cụ thể, cite bằng [p.SỐ_TRANG] (vd: [p.${currentPage}]).
- Nếu context không đủ thông tin, nói thẳng "Đoạn này tôi chưa thấy trong vùng đang đọc, có thể ở chương khác".
- Trả lời bằng tiếng Việt trừ khi user yêu cầu khác.
- Ngắn gọn, đi vào trọng tâm.

Context:
${context}`;
}

/**
 * Format raw chunks thành context string cho prompt.
 *
 * Format:
 *   [1] (note: title)
 *   chunk text...
 *
 *   [2] (highlight: book · p.42)
 *   chunk text...
 */
export function formatChunksAsContext(
  chunks: Array<{
    entity_type: string;
    entity_id: string;
    chunk_text: string;
    metadata: Record<string, unknown>;
  }>,
): string {
  return chunks
    .map((c, i) => {
      const label = buildLabel(c);
      return `[${i + 1}] (${label})\n${c.chunk_text}`;
    })
    .join('\n\n');
}

function buildLabel(chunk: {
  entity_type: string;
  metadata: Record<string, unknown>;
}): string {
  const m = chunk.metadata ?? {};
  switch (chunk.entity_type) {
    case 'note': {
      const title = typeof m.title === 'string' ? m.title : 'untitled';
      return `note: ${title}`;
    }
    case 'task': {
      const title = typeof m.title === 'string' ? m.title : 'task';
      return `task: ${title}`;
    }
    case 'highlight': {
      const book = typeof m.bookTitle === 'string' ? m.bookTitle : 'Book';
      const page = typeof m.page === 'number' ? ` p.${m.page}` : '';
      return `highlight: ${book}${page}`;
    }
    case 'book_chunk': {
      const book = typeof m.bookTitle === 'string' ? m.bookTitle : 'Book';
      const page = typeof m.page === 'number' ? ` p.${m.page}` : '';
      return `book: ${book}${page}`;
    }
    default:
      return chunk.entity_type;
  }
}