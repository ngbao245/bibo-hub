# 01. Architecture tool gốc

Tổng cộng ~5 file. Logic chính nằm 1 file duy nhất `src/main.js`.

## File tree

```
markdown-live-preview/
├── index.html              # Markup + load CDN html2pdf, link CSS theme
├── src/main.js             # Toàn bộ logic (editor, render, sync, export, theme, persist)
└── public/
    ├── css/
    │   ├── style.css                     # Layout 2 cột + split divider
    │   ├── github-markdown-light.css     # CSS preview light (từ npm github-markdown-css)
    │   └── github-markdown-dark_dimmed.css
    └── image/                            # Logo, sample
```

## Data flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ Monaco editor│ value  │ marked.parse │  html   │ DOMPurify   │
│  (textarea) │───────▶│   (markdown→ │────────▶│  .sanitize  │
└──────┬──────┘         │     html)    │         └──────┬──────┘
       │                └──────────────┘                │
       │ onDidChange                                    │ innerHTML
       │ → saveLastContent(Storehouse)                  ▼
       │                                        ┌──────────────┐
       │                                        │ #output div  │
       │ onDidScroll                            │  .markdown-  │
       │ (if sync) ratio → set preview.scrollTop│   body       │
       │                                        └──────┬───────┘
       ▼                                               │
   localStorage                                        │ querySelector('.mermaid')
                                                       ▼
                                              ┌──────────────────┐
                                              │ mermaid.render() │
                                              │  → replace SVG   │
                                              └──────────────────┘
```

## Key responsibilities trong `main.js`

| Block | Vai trò |
|---|---|
| `setupEditor()` | Create Monaco instance, listen `onDidChangeModelContent` → convert + save, `onDidScrollChange` → sync preview |
| `convert(md)` | `marked.parse` → `DOMPurify.sanitize` → set `#output.innerHTML` → `scheduleMermaidRender()` |
| `createMarkedRenderer()` | Override `renderer.code` để gặp ` ```mermaid ` thì xuất `<pre class="mermaid">...</pre>` thay vì code block |
| `renderMermaidDiagramsNow()` | Loop `.mermaid` elements, gọi `mermaid.render(id, source)`, replace `innerHTML` bằng SVG. Có version guard chống race |
| `reset()` | Confirm nếu đã edit, set lại defaultInput |
| `initScrollBarSync()` | Bind checkbox + lưu setting qua Storehouse |
| `setTheme()` / `setPreviewCss()` | Toggle `data-theme` attr trên `<html>`, swap link CSS preview |
| `exportPreviewToPdf()` | Force light theme trên clone, fetch light CSS, `html2pdf().set(opts).from(preview).save()` |
| `setupDivider()` | Drag split divider giữa 2 pane, lưu ratio |
| Storehouse | Wrapper localStorage có expire (key namespaced) |

## Lý do tổng thể chỉ 1 file

Tool nhỏ, không có state manager, không có routing. Toàn bộ là DOM imperative + Monaco SDK + listener.

Khi port sang hubibo (React + Zustand + Router) → tách thành component declarative, xem [04-integration-plan.md](./04-integration-plan.md).

## Bundle size warning

- `monaco-editor` ~2MB (lazy chunk)
- `mermaid` ~600KB
- `html2pdf.js` ~150KB (gồm `html2canvas` + `jsPDF`)
- `marked` + `dompurify` ~50KB

Trong hubibo, tool sẽ là lazy route nên không ảnh hưởng initial bundle. Nhưng có thể skip Monaco (đã có `CodeEditor.tsx` textarea) và skip Mermaid (nếu không cần) để tiết kiệm.