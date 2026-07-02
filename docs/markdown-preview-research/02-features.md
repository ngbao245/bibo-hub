# 02. Feature mapping — code gốc → hubibo

Mỗi feature trỏ tới đoạn code trong `markdown-live-preview/src/main.js` (external repo Kiro clone-local để reference, KHÔNG commit vào workspace).

## 1. Reset

### Tool gốc

```js
let reset = () => {
    let changed = editor.getValue() != defaultInput;
    if (hasEdited || changed) {
        var confirmed = window.confirm(confirmationMessage);
        if (!confirmed) return;
    }
    presetValue(defaultInput);
    document.querySelectorAll('.column').forEach((el) => el.scrollTo({ top: 0 }));
};
```

- Confirm chỉ khi đã edit → tránh popup phiền.
- Reset cả scroll position 2 pane.

### Hubibo

```tsx
function handleReset() {
  if (md !== DEFAULT_INPUT && !window.confirm('Reset? Mọi thay đổi sẽ mất.')) return;
  setMd(DEFAULT_INPUT);
  editorScrollRef.current?.scrollTo({ top: 0 });
  previewRef.current?.scrollTo({ top: 0 });
}
```

`DEFAULT_INPUT` lấy từ `defaultInput` trong `main.js` dòng ~17-80 (external repo).

---

## 2. Copy markdown source

### Tool gốc

```js
let copyToClipboard = (text, ok, err) => {
    navigator.clipboard.writeText(text).then(ok, err);
};
let notifyCopied = () => {
    let label = document.querySelector("#copy-button a");
    label.innerHTML = "Copied!";
    setTimeout(() => label.innerHTML = "Copy", 1000);
};
```

Inline label change "Copy" → "Copied!" → "Copy" sau 1s.

### Hubibo

Đã có `sonner` toast trong project. Dùng luôn:

```tsx
import { toast } from '@/components/ui/sonner';

async function handleCopy() {
  await navigator.clipboard.writeText(md);
  toast.success('Đã copy markdown');
}
```

---

## 3. Export PDF

Phần phức tạp nhất. Tool gốc:

```js
const previewElement = document.querySelector('#preview-wrapper');
if (typeof window.html2pdf !== 'function') { alert('...'); return; }

renderMermaidDiagrams('default')                  // re-render mermaid light theme
  .then(() => getLightMarkdownCss())              // fetch raw text github-markdown-light.css
  .then((lightCss) => {
    window.html2pdf().set({
        margin: 10,
        filename: 'markdown-preview.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            onclone: (clonedDoc) => {
                // 1. force light theme
                clonedDoc.documentElement.setAttribute('data-theme', 'light');
                // 2. swap preview CSS link
                clonedDoc.getElementById('gh-markdown-link')
                  ?.setAttribute('href', PREVIEW_CSS_LIGHT);
                // 3. inject inline <style> override
                const style = clonedDoc.createElement('style');
                style.textContent = lightCss + `
                  #preview-wrapper, #output, body {
                    background: #fff !important; color: #24292f !important;
                  }`;
                clonedDoc.head.appendChild(style);
                // 4. set width 190mm = A4 - margin
                const cloned = clonedDoc.getElementById('preview-wrapper');
                if (cloned) { cloned.style.width = '190mm'; cloned.style.maxWidth = '190mm'; }
            }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(previewElement).save();
  });
```

### Tricks quan trọng

- **`onclone` thay vì sửa DOM thật**: html2canvas clone vào iframe ẩn, sửa trong clone không ảnh hưởng UI.
- **`useCORS: true`** cho ảnh ngoài domain.
- **`scale: 2`** retina, file PDF nét.
- **Width 190mm = 210mm (A4) - 2 × 10mm margin** → preview rộng đúng khung in.
- **Inject inline `<style>`** thay vì rely vào CSS file trong clone (clone không load CSS bên ngoài → fetch text rồi inject inline).

### Hubibo

Xem [snippets/export-pdf.ts](./snippets/export-pdf.ts) — bản đã clean up.

---

## 4. Sync scroll

### Tool gốc

Monaco có `onDidScrollChange` rất tiện:

```js
editor.onDidScrollChange((e) => {
    if (!scrollBarSync) return;
    const scrollTop = e.scrollTop;
    const scrollHeight = e.scrollHeight;
    const height = editor.getLayoutInfo().height;
    const maxScrollTop = scrollHeight - height;
    const scrollRatio = scrollTop / maxScrollTop;

    const preview = document.querySelector('#preview');
    const targetY = (preview.scrollHeight - preview.clientHeight) * scrollRatio;
    preview.scrollTo(0, targetY);
});
```

**Note**: tool gốc chỉ sync 1 chiều editor → preview. Scroll preview không kéo editor.

### Hubibo (`CodeEditor` dùng textarea)

Textarea cũng có scroll event. Cần ref tới wrapper:

```tsx
function onEditorScroll(e: React.UIEvent<HTMLDivElement>) {
  if (!sync) return;
  const el = e.currentTarget;
  const ratio = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
  const p = previewRef.current;
  if (!p) return;
  p.scrollTop = ratio * (p.scrollHeight - p.clientHeight);
}
```

Hai chiều thì cần debounce/lock để tránh infinite loop:

```tsx
const isSyncing = useRef(false);
function syncScroll(src: HTMLElement, dst: HTMLElement) {
  if (isSyncing.current) { isSyncing.current = false; return; }
  isSyncing.current = true;
  const ratio = src.scrollTop / (src.scrollHeight - src.clientHeight || 1);
  dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
}
```

Chi tiết: [snippets/sync-scroll.ts](./snippets/sync-scroll.ts).

---

## 5. Đánh số dòng

### Tool gốc

Monaco editor mặc định có `lineNumbers: 'on'` (không set option = on).

### Hubibo

[`src/components/CodeEditor.tsx`](../../src/components/CodeEditor.tsx) đã có line number gutter:

```tsx
<div className="flex shrink-0 flex-col ... font-mono text-[10px] ..." aria-hidden>
  {Array.from({ length: lineCount }, (_, i) => (
    <span key={i}>{i + 1}</span>
  ))}
</div>
```

**Không cần làm gì** — dùng `<CodeEditor value={md} onChange={setMd} />` là có sẵn.

---

## 6. Ctrl+C / Ctrl+X / Ctrl+V theo style VSCode

### Tool gốc

Monaco có sẵn — đây là behaviour built-in của VSCode editor.

### Hubibo

[`CodeEditor.tsx`](../../src/components/CodeEditor.tsx) đã implement bằng tay với `document.execCommand`:

| Shortcut | Behaviour |
|---|---|
| `Ctrl+C` (no selection) | Copy nguyên dòng + `\n` |
| `Ctrl+X` (no selection) | Cut nguyên dòng, xoá luôn newline kế |
| `Ctrl+V` (no selection) | Clipboard end `\n` → paste above dòng hiện tại. Else → inline |
| `Ctrl+D` | Duplicate dòng |
| `Tab` / `Shift+Tab` | Indent/dedent 2 space |
| `Ctrl+Z` / `Ctrl+Y` | Native browser undo (vì dùng `execCommand`) |

**Quan trọng**: dùng `document.execCommand('insertText' / 'delete')` thay vì set value qua React state → undo stack browser còn hoạt động. Đây là điểm khéo của implementation hiện tại.

→ **Tool markdown preview KHÔNG cần custom thêm shortcut**, chỉ cần dùng `CodeEditor`.

---

## 7. Reset/save state persist

### Tool gốc

Storehouse-js wrap localStorage có expire:

```js
const localStorageNamespace = 'com.markdownlivepreview';
Storehouse.setItem(NS, 'last_state', content, new Date(2099, 1, 1));
```

### Hubibo

Đã có hook:

```tsx
import { useSessionStorage } from '@/hooks/useSessionStorage';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const [md, setMd] = useLocalStorage('md-preview/content', DEFAULT_INPUT);
const [sync, setSync] = useLocalStorage('md-preview/sync', false);
```

(SessionStorage nếu user muốn reset khi đóng tab. Tool gốc giữ vĩnh viễn → dùng localStorage.)

---

## 8. Theme switch

Tool gốc swap CSS file `github-markdown-light.css` ↔ `github-markdown-dark_dimmed.css`.

Hubibo đã có dark mode theo `data-theme` attr. Có 2 cách:

**Cách 1**: Import 2 file CSS conditionally — phức tạp, không hợp pattern hubibo.

**Cách 2** (recommend): Import `github-markdown-css` package, dùng CSS variable override với `[data-theme="dark"]`:

```css
/* src/styles/markdown-preview.css */
@import 'github-markdown-css/github-markdown.css';

[data-theme="dark"] .markdown-body {
  --bgColor-default: #0d1117;
  --fgColor-default: #e6edf3;
  /* ... github-markdown-css đã expose CSS vars ở v5+ */
}
```

Hoặc đơn giản: dùng `bg-card text-foreground` (token hubibo) cho preview wrapper, để typography GitHub style.

---

## 9. Mermaid (optional)

Tool gốc support code block ` ```mermaid ` render thành SVG. Override `marked.Renderer.code`:

```js
renderer.code = (token) => {
    const lang = (token.lang || '').match(/^\S*/)?.[0].toLowerCase();
    if (lang !== 'mermaid') return renderCode(token);
    return `<pre class="mermaid">${escapeHtml(token.text)}</pre>\n`;
};
```

Rồi sau `innerHTML = sanitized`:

```js
const elements = outputElement.querySelectorAll('.mermaid');
for (const el of elements) {
    const { svg } = await mermaid.render(`mermaid-${Date.now()}`, el.textContent);
    el.innerHTML = svg;
}
```

Có version guard chống race khi user gõ nhanh.

**Quyết định**: skip mermaid ở v1 hubibo (tiết kiệm 600KB bundle). Nếu cần thêm sau, copy nguyên block từ `main.js` dòng 140-215 (external repo).