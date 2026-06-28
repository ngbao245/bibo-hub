# 03. Dependencies — cần install gì

## Tool gốc

```json
{
  "marked": "^15.0.7",
  "dompurify": "^3.4.0",
  "github-markdown-css": "^5.8.1",
  "mermaid": "^11.15.0",
  "monaco-editor": "^0.52.2",
  "storehouse-js": "github:tanabe/Storehouse-js"
}
```

Plus CDN: `html2pdf.bundle.min.js` (gồm `html2canvas` + `jsPDF`).

## Hubibo — phân loại

### Đã có sẵn (KHÔNG install)

| Lib | Dùng cho | Note |
|---|---|---|
| `react` 18 | UI | Thay Monaco bằng React component |
| `react-router-dom` 6 | Route `/markdown` | Đăng ký trong `App.tsx` |
| `sonner` | Toast "Đã copy" | Thay `notifyCopied()` |
| Hook `useLocalStorage` | Persist content + setting | Thay Storehouse |
| `lucide-react` | Icon header (Copy, Download, RotateCcw, Eye) | |
| `CodeEditor.tsx` | Editor + line number + Ctrl+C/X/V | **Quan trọng**: dùng thẳng, không cần Monaco |

### Cần install

```bash
npm install marked dompurify github-markdown-css html2pdf.js
npm install -D @types/dompurify
```

| Lib | Size | Lý do |
|---|---|---|
| `marked` | ~50KB | Render markdown → HTML. Mature, fast |
| `dompurify` | ~25KB | Sanitize HTML chống XSS. Bắt buộc khi đổ markdown user |
| `github-markdown-css` | ~30KB CSS | Style preview giống GitHub |
| `html2pdf.js` | ~150KB | Export PDF |

Tổng phụ tải tool: ~250KB (lazy chunk, không vào initial bundle).

### Optional (skip v1)

| Lib | Quyết định |
|---|---|
| `mermaid` (~600KB) | Skip. Add sau nếu user cần diagrams. |
| `monaco-editor` (~2MB) | Skip. `CodeEditor.tsx` đã đủ tính năng yêu cầu. |
| `highlight.js` / `prism` | Skip v1. Code block render plain. Hubibo đã có `lowlight` cho Tiptap — có thể tận dụng sau. |

### Cân nhắc syntax highlight

Tool gốc dùng Monaco bên editor → syntax highlight markdown khi gõ. Trong hubibo, `CodeEditor` là textarea trơn → không highlight gõ. Acceptable cho v1.

Nếu cần highlight code blocks trong PREVIEW (khác với editor), thêm `marked-highlight` + `highlight.js`:

```bash
npm install marked-highlight highlight.js
```

```ts
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
}));
```

→ Để optional, v1 skip.

## Phương án thay `html2pdf.js`

`html2pdf.js` bundle to + maintainer ít update. Alternative:

- **Print CSS**: `window.print()` với `@media print` — không cần lib, nhưng user phải save-as-PDF từ dialog browser.
- **`jspdf` + `html2canvas` riêng**: control nhiều hơn nhưng cùng size.

Khuyến nghị v1: dùng `html2pdf.js` qua npm (không CDN như tool gốc) để build deterministic + offline OK.

```bash
npm install html2pdf.js
```

```ts
// vite cần ép default import
import html2pdf from 'html2pdf.js';
```

(nếu TS complain thiếu type, thêm `src/types/html2pdf.d.ts`:

```ts
declare module 'html2pdf.js' {
  const html2pdf: any;
  export default html2pdf;
}
```
)

## Tổng kết install command

```bash
npm install marked dompurify github-markdown-css html2pdf.js
npm install -D @types/dompurify
```

4 dep, ~250KB lazy. Build sau install: `npm run build` để confirm chunk size + không có TS error.