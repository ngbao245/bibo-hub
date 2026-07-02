# Snippets — ready-to-paste code

Snippet đã port từ tool gốc sang style hubibo (React + hook + token theme). Khi implement thật, copy code block tương ứng vào path destination.

| Snippet | Destination | Mô tả |
|---|---|---|
| [`render`](#render) | `src/lib/markdown-preview/render.ts` | `marked.parse` + `DOMPurify.sanitize` |
| [`sync-scroll`](#sync-scroll) | `src/lib/markdown-preview/sync-scroll.ts` | Bi-directional ratio sync với lock chống loop |
| [`export-pdf`](#export-pdf) | `src/lib/markdown-preview/export-pdf.ts` | `html2pdf` + force light theme trong `onclone` |
| [`MarkdownPreview`](#markdownpreview) | `src/routes/MarkdownPreview.tsx` | Page chính 2 cột |

## Note quan trọng

- Snippet dùng import từ `@/components/CodeEditor`, `@/hooks/useLocalStorage`, `@/components/ui/*`. Tất cả đã tồn tại trong hubibo.
- `useDebouncedEffect` đã có ở `src/hooks/useDebouncedEffect.ts`.
- `Button`, `Checkbox`, `toast` là shadcn/sonner — đã có.

## Còn thiếu

- `src/lib/markdown-preview/default-input.ts` — copy template từ `main.js` dòng ~17-80 (external repo `markdown-live-preview`, không có trong workspace).
- `src/styles/markdown-preview.css` — `@import 'github-markdown-css/github-markdown.css';` + override theme.
- `src/types/html2pdf.d.ts` — module declaration (xem 03-dependencies.md).
- `src/components/ToolIcon.tsx` — thêm entry icon mới.

## Verify checklist sau khi implement

- [ ] `npm run build` không error
- [ ] Gõ markdown → preview update sau ~100ms
- [ ] Ctrl+C trên dòng (no selection) → clipboard có cả dòng + `\n`
- [ ] Ctrl+X cắt dòng + xóa newline kế
- [ ] Ctrl+V với clipboard kết thúc `\n` → paste above dòng
- [ ] Line number gutter hiển thị bên trái editor
- [ ] Reset → confirm popup → về default
- [ ] Copy → toast "Đã copy markdown" + clipboard có content
- [ ] Sync scroll bật → scroll editor → preview theo
- [ ] Export PDF → file `markdown-preview.pdf` tải về, content rendered light theme

---

## render

**Destination**: `src/lib/markdown-preview/render.ts`
**Tham khảo**: `markdown-live-preview/src/main.js` fn `convert` + `createMarkedRenderer`.

```ts
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// One-time marked config
marked.setOptions({
  // @ts-expect-error - marked types lệch giữa version
  headerIds: false,
  mangle: false,
  gfm: true,
  breaks: false,
});

export function renderMarkdown(md: string): string {
  const html = marked.parse(md) as string;
  return DOMPurify.sanitize(html, {
    // Cho phép class để github-markdown-css apply
    ADD_ATTR: ['target'],
  });
}

// Optional helper: thêm target="_blank" cho link ngoài
export function renderMarkdownWithLinkTargets(md: string): string {
  const html = renderMarkdown(md);
  // Quick & dirty post-process. Có thể move sang DOMPurify hook nếu cần.
  return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}
```

---

## sync-scroll

**Destination**: `src/lib/markdown-preview/sync-scroll.ts`
**Tham khảo**: `markdown-live-preview/src/main.js` block `onDidScrollChange`.

```ts
/**
 * Sync `dst` scroll position theo ratio của `src`.
 * Dùng ref `lock` để chống infinite loop khi cả 2 pane đều listen scroll.
 */
export function syncScroll(
  src: HTMLElement,
  dst: HTMLElement,
  lock: { current: boolean },
) {
  if (lock.current) {
    lock.current = false;
    return;
  }
  const srcMax = src.scrollHeight - src.clientHeight;
  const dstMax = dst.scrollHeight - dst.clientHeight;
  if (srcMax <= 0 || dstMax <= 0) return;

  const ratio = src.scrollTop / srcMax;
  lock.current = true; // báo cho dst.onscroll biết đợt này là do sync
  dst.scrollTop = ratio * dstMax;
}
```

### Usage

```tsx
const editorRef = useRef<HTMLDivElement>(null);
const previewRef = useRef<HTMLDivElement>(null);
const lock = useRef(false);

<div ref={editorRef} onScroll={() => {
  if (sync && previewRef.current) syncScroll(editorRef.current!, previewRef.current, lock);
}}>
  <CodeEditor ... />
</div>
<div ref={previewRef} onScroll={() => {
  if (sync && editorRef.current) syncScroll(previewRef.current!, editorRef.current, lock);
}}>
  <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
</div>
```

---

## export-pdf

**Destination**: `src/lib/markdown-preview/export-pdf.ts`
**Tham khảo**: `markdown-live-preview/src/main.js` fn `exportPreviewToPdf`.

Fetch raw CSS text của `github-markdown-light` để inject vào clone iframe. Tool gốc dùng fetch từ public folder. Hubibo có 2 cách:

1. Vite raw import: `import lightCss from 'github-markdown-css/github-markdown-light.css?raw'`
2. Fetch URL: `fetch(new URL('github-markdown-css/github-markdown-light.css', import.meta.url))`

Cách 1 đơn giản hơn, không async.

```ts
import html2pdf from 'html2pdf.js';
import lightCss from 'github-markdown-css/github-markdown-light.css?raw';

const A4_CONTENT_WIDTH_MM = '190mm'; // 210mm - 2 × 10mm margin

export async function exportPreviewToPdf(
  previewElement: HTMLElement,
  filename = 'markdown-preview.pdf',
) {
  const opts = {
    margin: 10,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      onclone: (clonedDoc: Document) => {
        // Force light theme trong clone (html2canvas render từ clone iframe).
        clonedDoc.documentElement.setAttribute('data-theme', 'light');

        // Inject github-markdown light CSS + override background.
        const style = clonedDoc.createElement('style');
        style.id = 'export-light-css';
        style.textContent = `
${lightCss}
.markdown-body, body {
  background: #fff !important;
  color: #24292f !important;
}
`;
        clonedDoc.head.appendChild(style);

        // Set width = A4 content width để khớp PDF page.
        const cloned = clonedDoc.querySelector<HTMLElement>('[data-md-preview-root]');
        if (cloned) {
          cloned.style.background = '#fff';
          cloned.style.color = '#24292f';
          cloned.style.width = A4_CONTENT_WIDTH_MM;
          cloned.style.maxWidth = A4_CONTENT_WIDTH_MM;
        }
      },
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  await html2pdf().set(opts).from(previewElement).save();
}
```

### Usage

```tsx
const previewRef = useRef<HTMLDivElement>(null);

async function handleExport() {
  if (!previewRef.current) return;
  try {
    await exportPreviewToPdf(previewRef.current);
    toast.success('Đã export PDF');
  } catch (err) {
    toast.error('Export PDF thất bại');
  }
}

<div ref={previewRef} data-md-preview-root>
  <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
</div>
```

---

## MarkdownPreview

**Destination**: `src/routes/MarkdownPreview.tsx`

Page route — editor markdown + live preview, sync scroll, reset, copy, export PDF.

```tsx
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Download, RotateCcw } from 'lucide-react';

import CodeEditor from '@/components/CodeEditor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDebouncedEffect } from '@/hooks/useDebouncedEffect';

import { renderMarkdown } from '@/lib/markdown-preview/render';
import { exportPreviewToPdf } from '@/lib/markdown-preview/export-pdf';
import { syncScroll } from '@/lib/markdown-preview/sync-scroll';
import { DEFAULT_INPUT } from '@/lib/markdown-preview/default-input';

import '@/styles/markdown-preview.css';

export default function MarkdownPreviewPage() {
  const [md, setMd] = useLocalStorage('md-preview/content', DEFAULT_INPUT);
  const [sync, setSync] = useLocalStorage('md-preview/sync', false);

  // Debounce render để gõ liền tay không lag (>10k dòng).
  const [html, setHtml] = useState(() => renderMarkdown(md));
  useDebouncedEffect(() => setHtml(renderMarkdown(md)), [md], 100);

  const editorScrollRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);

  function handleReset() {
    if (md !== DEFAULT_INPUT && !window.confirm('Reset markdown? Mọi thay đổi sẽ mất.')) return;
    setMd(DEFAULT_INPUT);
    editorScrollRef.current?.scrollTo({ top: 0 });
    previewRef.current?.scrollTo({ top: 0 });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(md);
      toast.success('Đã copy markdown');
    } catch {
      toast.error('Copy thất bại');
    }
  }

  async function handleExport() {
    if (!previewRef.current) return;
    try {
      await exportPreviewToPdf(previewRef.current);
      toast.success('Đã export PDF');
    } catch {
      toast.error('Export PDF thất bại');
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        <Button asChild size="sm" variant="ghost">
          <Link to="/"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="mr-auto text-sm font-semibold">Markdown Preview</h1>

        <Button size="sm" variant="ghost" onClick={handleReset}>
          <RotateCcw className="size-4" />Reset
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCopy}>
          <Copy className="size-4" />Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={handleExport}>
          <Download className="size-4" />Export PDF
        </Button>

        <label className="ml-2 flex select-none items-center gap-1.5 text-xs">
          <Checkbox checked={sync} onCheckedChange={(v) => setSync(!!v)} />
          Sync scroll
        </label>
      </header>

      {/* Split panes */}
      <div className="flex flex-1 overflow-hidden">
        <div
          ref={editorScrollRef}
          className="flex w-1/2 overflow-auto border-r border-border"
          onScroll={() => {
            if (sync && previewRef.current && editorScrollRef.current) {
              syncScroll(editorScrollRef.current, previewRef.current, lock);
            }
          }}
        >
          <CodeEditor value={md} onChange={setMd} placeholder="Type markdown..." />
        </div>

        <div
          ref={previewRef}
          data-md-preview-root
          className="w-1/2 overflow-auto"
          onScroll={() => {
            if (sync && editorScrollRef.current && previewRef.current) {
              syncScroll(previewRef.current, editorScrollRef.current, lock);
            }
          }}
        >
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
```