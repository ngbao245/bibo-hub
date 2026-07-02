# Adding a New Tool — Recipe ngắn

Doc bao 2 dạng tool: **Modal** (Calculator, Translate, Encoder) và **Route** (Notes, Movies, Markdown Preview). Chọn dạng nào phụ thuộc câu hỏi ở section 0.

## 0. Quyết định: Modal hay Route?

### Decision matrix

| Tiêu chí | Modal | Route |
|---|---|---|
| Interaction time | < 30 giây / lần dùng | > 1 phút, có workflow |
| Layout | 1 form, 1 view | Split panes, sidebar + main, hoặc scroll dài |
| State | Reset khi đóng OK | Persist qua session (`useLocalStorage`), có URL riêng |
| Có back button riêng? | Không | Có |
| Có async data (query) heavy? | Không (data đơn giản) | Có (CRUD, list, filter) |
| Cần deep-link (share URL) | Không | Có |
| Ví dụ trong project | Calculator, Translate, Encoder, Secret, Savings | Notes, Tasks, Movies, Keycap, Reader |

### Không rõ chọn cái nào?

- Bắt đầu bằng **Modal** nếu tool có < 3 field input + 1 output. Sau này phình ra thì refactor sang Route.
- Bắt đầu bằng **Route** nếu có list data từ API (dù ngắn).

### Câu hỏi bổ sung (cho cả 2 dạng)

| Câu hỏi | Ảnh hưởng |
|---|---|
| Có dependency external mới không? | Có → `npm install` (pin version). Lib thiếu types → thêm `src/types/{lib}.d.ts`. |
| Cần persist state qua session? | `useLocalStorage('tool-name/key', default)`. |
| Có research / docs lib gốc? | Có → `docs/{tool}-research/` (mẫu: `markdown-preview-research/`). |
| Có shortcut Alt+X? | Check trùng với `tools-registry.md` trước. Đăng ký trong `useGlobalShortcuts`. |

---

## Path A: Tool dạng Modal

Dùng khi thoả matrix trên. Chi tiết ở section 5. Nhảy xuống nếu chắc chắn cần Modal.

## Path B: Tool dạng Route

Dùng khi thoả matrix trên. Section 1-4 + 6-10 áp dụng cho Route. Đây là path phổ biến hơn.

---

## 1. Path B — Folder layout chuẩn (Route)

Một tool route phức tạp thường có 4 chỗ:

```
src/
├── routes/{Tool}.tsx                 # Page chính, export default
├── components/{tool-kebab}/          # (optional) sub-component riêng
│   └── README.md
├── lib/{tool-kebab}/                 # logic thuần (không React)
│   ├── README.md
│   └── *.ts
├── styles/{tool-kebab}.css           # (optional) CSS riêng
└── types/{lib-name}.d.ts             # (optional) type cho dep thiếu types
```

Tool đơn giản (1 file < 300 dòng): chỉ cần `src/routes/{Tool}.tsx`. Khi page phình to thì refactor.

---

## 2. Path B — Step-by-step (theo đúng order khi làm Markdown Preview)

### Step 1: Install dependencies

```bash
npm install <runtime-deps>
npm install -D <dev-types-deps>
```

Lưu ý:
- Pin version cụ thể, không dùng `*`.
- Dep build to (>500KB) → đảm bảo route lazy load (xem step 5).
- Nếu lib không có types official, tạo `src/types/{lib}.d.ts` (mẫu: [src/types/html2pdf.d.ts](../src/types/html2pdf.d.ts)).

### Step 2: Viết logic thuần trong `src/lib/{tool}/`

Tách phần không phụ thuộc React ra lib trước. Test mental model dễ hơn, snippet reusable.

Ví dụ Markdown Preview:

| File | Mô tả |
|---|---|
| `lib/markdown-preview/render.ts` | `renderMarkdown(md: string): string` — marked + DOMPurify |
| `lib/markdown-preview/sync-scroll.ts` | `syncScroll(src, dst, lock)` — DOM math |
| `lib/markdown-preview/export-pdf.ts` | `exportPreviewToPdf(el, filename)` |
| `lib/markdown-preview/default-input.ts` | Template constant |

Rule:
- Function pure, nhận tham số tường minh.
- Không gọi `useState`, không touch global state.
- Comment đầu file ghi rõ "Port từ ..." nếu lấy từ source ngoài.

### Step 3: (Optional) CSS riêng

`src/styles/{tool}.css`:

```css
@import 'github-markdown-css/github-markdown.css';

.markdown-body { /* override */ }

[data-theme='dark'] .markdown-body { color-scheme: dark; }
```

Import trong route component: `import '@/styles/{tool}.css';`.

> Theo `system.md`: dùng semantic token (`bg-card`, `text-foreground`) cho UI mới. CSS riêng chỉ khi cần override third-party CSS (như typography GitHub).

### Step 4: Viết route component `src/routes/{Tool}.tsx`

Pattern mẫu (tham khảo [`MarkdownPreview.tsx`](../src/routes/MarkdownPreview.tsx) hoặc [`CodeCompare.tsx`](../src/routes/CodeCompare.tsx)):

```tsx
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, /* action icons */ } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useLocalStorage } from '@/hooks/useLocalStorage';

// import logic từ lib
import { someAction } from '@/lib/{tool}/...';

export default function ToolPage() {
  const [state, setState] = useLocalStorage('tool/key', defaultValue);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="mr-auto text-sm font-semibold">Tool name</h1>
        {/* action buttons */}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* body */}
      </div>
    </div>
  );
}
```

Checklist component:
- [ ] `export default` (lazy import yêu cầu)
- [ ] Header có nút back về `/`
- [ ] Container `flex h-screen flex-col` để header sticky + body scroll
- [ ] Semantic token only: `bg-background`, `bg-card`, `border-border`, `text-foreground`
- [ ] Action button dùng `<Button variant="outline" size="sm">` (xem CodeCompare)
- [ ] Toast cho action thành công/fail: `toast.success` / `toast.error`
- [ ] State quan trọng qua `useLocalStorage` (persist)
- [ ] Loading/disabled state cho async action (`exporting`, `mutating`)
- [ ] Không `console.log`

### Step 5: Đăng ký route trong `App.tsx`

```tsx
// 1. Thêm lazy import (cùng nhóm với các route khác)
const ToolName = lazy(() => import('./routes/ToolName'));

// 2. Thêm <Route> trước fallback "*"
<Route path="/tool-path" element={<ToolName />} />
```

> Lazy import **bắt buộc** — tách chunk, không phình initial bundle.

### Step 6: Thêm vào `src/lib/tools.ts`

```ts
{
  id: 'tool-id',                          // kebab-case, match ICON_MAP key
  label: 'Tool name',                     // hiển thị card
  shortcut: 'Alt+M',                      // (optional)
  group: 'Developer',                     // Productivity | Finance | Utilities | Tracking | Developer | Admin
  action: { kind: 'route', path: '/tool-path' },
  description: 'Mô tả 1 dòng',
},
```

### Step 7: Thêm icon trong `src/components/ToolIcon.tsx`

```tsx
import { /* existing */, FileText } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  /* existing */,
  'tool-id': FileText,
};
```

### Step 8: (Optional) Shortcut

Nếu khai báo `shortcut: 'Alt+M'` ở step 6, thêm handler trong `src/hooks/useGlobalShortcuts.ts`. Bỏ qua bước này nếu không cần.

### Step 9: README cho folder mới

Theo `.kiro/steering/readme-pattern.md`, tạo:
- `src/lib/{tool}/README.md`
- `src/components/{tool}/README.md` (nếu có folder)

Update `.kiro/steering/tools-registry.md` bảng nhóm phù hợp (đây là source of truth cho tool list).

### Step 10: Verify

```bash
npm run build
```

Pass = TypeScript OK + Vite bundled. Bundle size warning >500KB là OK nếu chunk thuộc lazy route.

Manual test:
- [ ] Click tool ở Hub → vào page
- [ ] Refresh → state vẫn còn (nếu dùng `useLocalStorage`)
- [ ] Tất cả action chính work
- [ ] Toast hiện đúng case
- [ ] Mobile width OK
- [ ] Dark/light đều hiển thị đúng (không hard-code màu)

---

## 3. Anti-patterns thường gặp (cả 2 path)

| ❌ Sai | ✅ Đúng |
|---|---|
| Set state qua `localStorage.setItem` raw | `useLocalStorage` hook |
| `bg-blue-500` cho accent | `bg-primary` token |
| `window.alert(...)` | `toast.success/error` |
| Eager import route trong `App.tsx` | `lazy(() => import(...))` |
| Logic render markdown trong component | Tách `lib/{tool}/render.ts` |
| Dùng `any` cho dep thiếu types | `src/types/{lib}.d.ts` declaration |
| Quên thêm `id` vào `ICON_MAP` | Tool icon sẽ fallback `StickyNote` |
| Path `/markdown-preview` quá dài | Path ngắn dễ nhớ `/markdown` |

---

## 4. Khi thêm dep external bundle to (như html2pdf)

1. **Import động trong route** — Vite tự tách chunk:
   ```ts
   // Vẫn import top-level OK vì route đã lazy. Không cần dynamic import bên trong.
   import html2pdf from 'html2pdf.js';
   ```

2. **Check bundle**:
   ```bash
   npm run build
   ```
   Kiểm tra `dist/assets/{ToolName}-*.js` size. Nếu chunk này không phình `index.js` thì OK.

3. **Vite raw / inline import** khi cần CSS string của dep:
   ```ts
   import lightCss from 'github-markdown-css/github-markdown-light.css?inline';
   ```

   Khai báo trong `src/types/{tool}.d.ts`:
   ```ts
   declare module '*.css?inline' {
     const css: string;
     export default css;
   }
   ```

---

## 5. Path A: Tool dạng Modal — quy trình đầy đủ

Modal nhanh hơn Route (không lazy load, không đổi URL) nhưng chỉ hợp cho tool đơn giản.

### Step 5.1: Tạo modal component

`src/modals/{Tool}.tsx`:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useModalStore } from '@/stores/modalStore';

export default function ToolModal() {
  const isOpen = useModalStore((s) => s.current === 'tool-id');
  const close = useModalStore((s) => s.close);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tool name</DialogTitle>
        </DialogHeader>
        {/* body */}
      </DialogContent>
    </Dialog>
  );
}
```

Checklist:
- [ ] `export default`
- [ ] Semantic token only
- [ ] `useModalStore` selector cụ thể (không subscribe cả store)
- [ ] Không lồng thêm `<Dialog>` bên trong — 1 modal = 1 dialog root

### Step 5.2: Đăng ký `modalId`

`src/stores/modalStore.ts` — thêm literal vào union `ModalId`:

```ts
export type ModalId =
  | 'calculator'
  | 'translate'
  | 'tool-id';  // ← thêm dòng này
```

### Step 5.3: Mount trong `App.tsx`

Modal mount EAGER (không lazy) ở cuối `<App>`:

```tsx
import ToolModal from './modals/ToolModal';

<Router>
  {/* routes */}
  {/* ... existing modals */}
  <ToolModal />
</Router>
```

### Step 5.4: Thêm vào `tools.ts`

```ts
{
  id: 'tool-id',
  label: 'Tool name',
  shortcut: 'Alt+M',
  group: 'Utilities',
  action: { kind: 'modal', modalId: 'tool-id' },
  description: 'Mô tả 1 dòng',
},
```

### Step 5.5: Icon + Shortcut

- Icon: thêm vào `src/components/ToolIcon.tsx` (`ICON_MAP`).
- Shortcut: nếu khai báo `shortcut` ở step 5.4, thêm handler trong `useGlobalShortcuts`.

### Step 5.6: Registry + verify

- Update `.kiro/steering/tools-registry.md` — thêm row nhóm phù hợp, cột Route ghi `(modal)`.
- `npm run build` pass.
- Manual test: click tool ở Hub → modal mở. Nhấn Esc / bấm ra ngoài → đóng.

Tham khảo:
- [`src/modals/Calculator.tsx`](../src/modals/Calculator.tsx) — modal đơn giản
- [`src/modals/Encoder.tsx`](../src/modals/Encoder.tsx) — modal có tabs
- [`src/modals/Backup.tsx`](../src/modals/Backup.tsx) — modal có file I/O

---

## 6. Templates copy-paste

### Route component skeleton

```tsx
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ToolPage() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="mr-auto text-sm font-semibold">Tool name</h1>
      </header>
      <div className="flex-1 overflow-auto p-4">
        Hello tool
      </div>
    </div>
  );
}
```

### `tools.ts` entry

```ts
{
  id: 'my-tool',
  label: 'My tool',
  group: 'Developer',
  action: { kind: 'route', path: '/my-tool' },
  description: 'Mô tả 1 dòng',
},
```

### Lib README skeleton

```markdown
# `src/lib/my-tool/` — Logic util cho My Tool

Util thuần (không React) cho route `/my-tool`.

## File

| File | Mô tả |
|---|---|
| `render.ts` | Convert input → output |

## Doc liên quan

- **[../../docs/my-tool.md](../../docs/my-tool.md)** — spec
```

---

## Case study đầy đủ

Xem **[markdown-preview-research/](./markdown-preview-research/)** — research lib gốc + 4 doc + snippets + flow port sang hubibo. Là pattern khi build tool dựa trên open source project có sẵn.