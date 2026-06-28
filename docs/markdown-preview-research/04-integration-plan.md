# 04. Integration plan — đưa tool vào hubibo

## Folder structure đề xuất

```
src/
├── routes/
│   └── MarkdownPreview.tsx         # Page route /markdown (2 cột, header actions)
├── components/
│   └── markdown-preview/
│       ├── README.md
│       ├── MarkdownToolbar.tsx     # Header buttons: Reset, Copy, Export PDF, Sync toggle
│       └── MarkdownRenderer.tsx    # Memoized preview pane (marked + DOMPurify)
├── lib/
│   └── markdown-preview/
│       ├── README.md
│       ├── default-input.ts        # Template markdown mặc định
│       ├── render.ts               # convertMarkdown(md) → safe html
│       ├── sync-scroll.ts          # Bi-directional sync helper
│       └── export-pdf.ts           # exportPreviewToPdf(el, theme)
├── styles/
│   └── markdown-preview.css        # @import github-markdown-css + theme override
└── types/
    └── html2pdf.d.ts               # Module declaration
```

Theo pattern hubibo (route + components/ + lib/ riêng theo feature). Tham khảo `docs/ADDING_NEW_FEATURE.md`.

## Bước-by-bước

### Bước 1: Install deps

```bash
npm install marked dompurify github-markdown-css html2pdf.js
npm install -D @types/dompurify
```

### Bước 2: Type declaration

Tạo `src/types/html2pdf.d.ts`:

```ts
declare module 'html2pdf.js' {
  const html2pdf: () => {
    set(opts: Record<string, unknown>): ReturnType<typeof html2pdf>;
    from(el: HTMLElement): ReturnType<typeof html2pdf>;
    save(): Promise<void>;
  };
  export default html2pdf;
}
```

### Bước 3: Render util

`src/lib/markdown-preview/render.ts` — xem [snippets/render.ts](./snippets/render.ts).

### Bước 4: Export PDF util

`src/lib/markdown-preview/export-pdf.ts` — xem [snippets/export-pdf.ts](./snippets/export-pdf.ts).

### Bước 5: CSS

`src/styles/markdown-preview.css`:

```css
@import 'github-markdown-css/github-markdown.css';

.markdown-body {
  background: transparent;
  color: var(--foreground);
  padding: 16px 24px;
}

[data-theme="dark"] .markdown-body {
  color-scheme: dark;
}
```

Import trong `MarkdownPreview.tsx`:

```ts
import '@/styles/markdown-preview.css';
```

### Bước 6: Route component

`src/routes/MarkdownPreview.tsx` — xem [snippets/MarkdownPreview.tsx](./snippets/MarkdownPreview.tsx).

### Bước 7: Đăng ký route

`src/App.tsx`:

```tsx
const MarkdownPreview = lazy(() => import('./routes/MarkdownPreview'));

// Trong <Routes>:
<Route path="/markdown" element={<MarkdownPreview />} />
```

### Bước 8: Thêm vào tools list

`src/lib/tools.ts`:

```ts
{
  id: 'markdown-preview',
  label: 'Markdown Preview',
  group: 'Developer',
  action: { kind: 'route', path: '/markdown' },
  description: 'Markdown editor + live preview, export PDF',
},
```

### Bước 9: Icon

`src/components/ToolIcon.tsx` — thêm entry `markdown-preview` (vd `FileText` từ lucide).

### Bước 10: Verify

```bash
npm run build
```

Chạy local + click tool:
- Gõ markdown → preview update real-time
- Reset → confirm dialog → về default
- Copy → toast hiện + clipboard có content
- Sync scroll → bật checkbox, scroll editor → preview scroll
- Line number, Ctrl+C/X/V → đã có sẵn từ `CodeEditor`
- Export PDF → file `markdown-preview.pdf` download

## Pattern conventions cần tuân thủ

Theo `.kiro/steering/system.md`:

- Token-based theme: dùng `bg-card`, `text-foreground`, `border-border` thay vì shade Tailwind.
- Path alias `@/`.
- `useLocalStorage` thay vì raw `localStorage`.
- Sonner `toast` thay vì alert.
- Component PascalCase, util kebab-case.
- TypeScript strict — không `any` trừ chỗ html2pdf.
- KHÔNG console.log.

Theo `.kiro/steering/readme-pattern.md`:

- Tạo `src/components/markdown-preview/README.md` (template trong steering).
- Tạo `src/lib/markdown-preview/README.md`.
- Update `docs/FOLDER_STRUCTURE.md` thêm 2 entry.

## Edge cases cần handle

| Case | Xử lý |
|---|---|
| User paste markdown rất dài (10k dòng) | Debounce convert 100ms (`useDebouncedEffect`) |
| Markdown chứa `<script>` | DOMPurify strip — đã có |
| Sync scroll khi 2 pane khác chiều cao | Ratio-based — đã handle |
| Sync scroll infinite loop | `isSyncing` ref guard |
| Export PDF khi dark theme | Force light trong `onclone` |
| Export PDF với ảnh CORS | `useCORS: true` |
| User reset khi chưa edit gì | Không hỏi confirm (compare với DEFAULT_INPUT) |
| Tab/page refresh | `useLocalStorage` lưu content + setting |

## Roadmap optional

| v | Feature |
|---|---|
| v1 | Reset / Copy / Export PDF / Sync scroll / Line num / Ctrl shortcuts |
| v1.1 | Syntax highlight code block (marked-highlight + highlight.js hoặc lowlight) |
| v1.2 | Mermaid support |
| v1.3 | Drag divider giữa 2 pane (theo tool gốc) |
| v1.4 | Export Markdown file (.md download) |
| v1.5 | Import .md file |