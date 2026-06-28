# Markdown Live Preview — Research & Build Plan

Tổng hợp nghiên cứu từ project gốc [`markdown-live-preview/`](../../markdown-live-preview/) để build lại tool tương đương trong hubibo (`/markdown` route).

## Tool gốc làm gì

Web tool 2 cột: editor markdown bên trái, preview HTML render bên phải, sync scroll, đổi theme dark/light, export PDF. Stack: Monaco editor + `marked` + `DOMPurify` + `mermaid` + `html2pdf.js`.

## Yêu cầu hubibo (do user chốt)

| Feature | Tool gốc dùng | Sẽ làm trong hubibo |
|---|---|---|
| Reset | Xoá content + confirm | Như cũ + dùng `window.confirm` |
| Copy | `navigator.clipboard.writeText(editor.getValue())` | Như cũ + toast |
| Export PDF | `html2pdf.js` clone preview, force light CSS | Như cũ, dùng `html2pdf.js` (CDN hoặc npm) |
| Sync scroll | Tính scrollRatio editor → set scrollTop preview | Như cũ, listen scroll cả 2 chiều |
| Đánh số dòng | Monaco built-in `lineNumbers` | Đã có sẵn trong `CodeEditor.tsx` (gutter render line index) |
| Ctrl+C dòng code | Selection rỗng → copy whole line + `\n` | Đã có sẵn trong `CodeEditor.tsx` |
| Ctrl+X dòng code | Selection rỗng → cut line | Đã có sẵn trong `CodeEditor.tsx` |
| Ctrl+V paste | Clipboard end `\n` → paste above line | Đã có sẵn trong `CodeEditor.tsx` |

> Note: `src/components/CodeEditor.tsx` đã implement đầy đủ VSCode-like shortcut (Ctrl+C/X/V/D, Tab/Shift+Tab, line gutter, native undo qua `execCommand`). Tool này tái sử dụng được toàn bộ — không cần làm lại logic editor.

## Các bước

- **[01-architecture.md](./01-architecture.md)** — Cấu trúc tool gốc (file gì làm gì, data flow).
- **[02-features.md](./02-features.md)** — Mapping từng feature → code snippet cụ thể trong `main.js`.
- **[03-dependencies.md](./03-dependencies.md)** — Lib nào cần `npm install`, lib nào đã có, lib nào nên thay.
- **[04-integration-plan.md](./04-integration-plan.md)** — Plan tích hợp vào hubibo (folder structure, route, tool entry).
- **[snippets/](./snippets/)** — Code ready-to-paste cho 4 phần chính: render markdown, sync scroll, export PDF, mermaid.

## Quick start (TL;DR)

1. `npm install marked dompurify html2pdf.js` (mermaid optional)
2. Tạo route `src/routes/MarkdownPreview.tsx` 2 cột, dùng lại `CodeEditor` bên trái.
3. Render markdown qua `marked.parse() + DOMPurify.sanitize()` vào `<div className="markdown-body">` bên phải.
4. Sync scroll: listen scroll editor wrapper, set scrollTop preview theo ratio.
5. Export PDF: clone preview, fetch `github-markdown-css` light, `html2pdf().from(preview).save()`.
6. Thêm vào `src/lib/tools.ts` group `Developer`, route `/markdown`.

Chi tiết từng bước trong các file `01..04`.

## Doc liên quan

- **[../FOLDER_STRUCTURE.md](../FOLDER_STRUCTURE.md)** — Map tổng thể folder hubibo.
- **[../ADDING_NEW_FEATURE.md](../ADDING_NEW_FEATURE.md)** — Quy trình thêm tool mới (route + tools.ts + nav).
- **[../../src/components/CodeEditor.tsx](../../src/components/CodeEditor.tsx)** — Editor có sẵn (line numbers + shortcut).
- **[../../markdown-live-preview/src/main.js](../../markdown-live-preview/src/main.js)** — Source tool gốc.