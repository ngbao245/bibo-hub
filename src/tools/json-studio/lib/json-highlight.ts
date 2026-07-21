// ============================================================
// Lightweight JSON syntax highlighter (regex, 1-pass).
// Dùng cho NodeDetailsDialog + DataEditor overlay.
//
// Palette: Tomorrow Night Bright-ish khớp với screenshot jsoncrack.
// KHÔNG kéo Shiki / Prism: ~2MB JS + WASM, overkill cho 5 token type.
//
// Lý do tách ra lib (không inline trong component):
//  - Reuse cho DataEditor overlay (mỗi keystroke phải tokenize lại).
//  - Test riêng được khi cần (hiện chưa có test setup).
// ============================================================

export const JSON_HIGHLIGHT_COLORS = {
  punct: '#C5C8C6',
  key: '#C7444A',
  string: '#9AA83A',
  number: '#6089B4',
  literal: '#408080', // true / false / null
} as const;

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Tokenizer 1-pass.
// Bắt theo thứ tự ưu tiên trong regex group:
//  1. chuỗi "..."  (có thể là key nếu sau đó là `:` → optional whitespace + `:`)
//  2. số (có dấu, decimal, exponent)
//  3. true / false / null
//
// String regex `"(?:\\.|[^"\\])*"` xử lý escape sequence chuẩn JSON.
// Nếu input KHÔNG phải JSON hợp lệ (vd đang gõ dở), regex vẫn match
// các phần đã đóng và fallback về punct color cho phần còn lại.
export const highlightJson = (raw: string): string => {
  const escaped = escapeHtml(raw);
  const inner = escaped.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false|null)\b/g,
    (_m, str, colon, num, literal) => {
      if (str) {
        if (colon) {
          // string trước `:` → key (đỏ), colon giữ màu punct.
          return (
            `<span style="color:${JSON_HIGHLIGHT_COLORS.key}">${str}</span>` +
            `<span style="color:${JSON_HIGHLIGHT_COLORS.punct}">${colon}</span>`
          );
        }
        return `<span style="color:${JSON_HIGHLIGHT_COLORS.string}">${str}</span>`;
      }
      if (num) {
        return `<span style="color:${JSON_HIGHLIGHT_COLORS.number}">${num}</span>`;
      }
      if (literal) {
        return `<span style="color:${JSON_HIGHLIGHT_COLORS.literal}">${literal}</span>`;
      }
      return _m;
    }
  );
  // Wrap toàn bộ trong span punct → các phần không match (dấu phẩy, ngoặc,
  // whitespace) sẽ inherit màu xám nhạt.
  return `<span style="color:${JSON_HIGHLIGHT_COLORS.punct}">${inner}</span>`;
};

// Ngưỡng size mà DataEditor sẽ TẮT highlight để tránh lag khi gõ.
// 200KB ≈ 200k char JSON; tokenize 200k char mỗi keystroke ~10ms trên
// máy trung bình (regex 1-pass, không alloc nhiều). Trên đó user sẽ
// cảm thấy gõ lag → fallback plain text.
export const JSON_HIGHLIGHT_MAX_LENGTH = 200_000;