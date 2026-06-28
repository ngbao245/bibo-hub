# Adding a New Tool — Recipe ngắn

Doc này áp dụng cho tool dạng **utility 1 page** (giống Markdown Preview, Code Compare, Project Packer). Không phải CRUD feature — cho CRUD xem [ADDING_NEW_FEATURE.md](./ADDING_NEW_FEATURE.md).

> Case study: cách Markdown Preview (`/markdown`) được thêm vào. Mọi bước trong doc này đều có file thật tham chiếu.

---

## 0. Quyết định trước khi code

| Câu hỏi | Ảnh hưởng |
|---|---|
| Tool là **modal** (mở overlay, chia sẻ global shortcut) hay **route** (page riêng full screen)? | Modal → `src/modals/`, register trong `modalStore` + `App.tsx`. Route → `src/routes/`, lazy import. |
| Có **state nặng / split layout / scroll riêng** không? | Có → route. Không → modal. |
| Có **dependency external** mới không? | Có → `npm install`, optional thêm `*.d.ts` cho lib thiếu types. |
| Cần **persist** state qua session? | `useLocalStorage('tool-name/key', default)`. |
| Có **research / docs lib gốc** không? | Có → tạo `docs/{tool}-research/` (xem [markdown-preview-research/](./markdown-preview-research/) làm mẫu). |

---

## 1. Folder layout chuẩn

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

## 2. Step-by-step (theo đúng order khi làm Markdown Preview)

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
  group: 'Developer',                     // Productivity | Finance | Utilities | Tracking | Developer
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

Update `docs/FOLDER_STRUCTURE.md` thêm row mới.

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

## 3. Anti-patterns thường gặp

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

## 5. Khi tool là modal thay vì route

Modal nhanh hơn route nhưng giới hạn UI. Quy trình:

1. Tạo `src/modals/{Tool}.tsx` — component `<Dialog>` từ `@/components/ui/dialog`.
2. Thêm `modalId` vào `src/stores/modalStore.ts` (union type `ModalId`).
3. Mount eager trong `App.tsx` (cuối file): `<Tool />`.
4. Thêm vào `tools.ts` với `action: { kind: 'modal', modalId: 'tool' }`.
5. Icon + shortcut như tool route.

Tham khảo [`Calculator.tsx`](../src/modals/Calculator.tsx) hoặc [`Encoder.tsx`](../src/modals/Encoder.tsx).

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