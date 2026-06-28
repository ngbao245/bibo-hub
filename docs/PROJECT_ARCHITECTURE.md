# 📐 BiBo Tools v2 - Kiến Trúc Project

## 🎯 Tổng Quan

**BiBo Tools v2** là ứng dụng web all-in-one dạng hub với nhiều công cụ nhỏ, được thiết kế theo mô hình **modular monolith**. Mỗi công cụ (Notes, Tasks, Movies, Keycap...) độc lập nhưng chia sẻ layer UI, auth, state chung.

### Tech Stack

| Lớp | Công nghệ |
|-----|----------|
| **Build** | Vite 6 + TypeScript 5.7 (strict) |
| **UI** | React 18 + Tailwind 3 + shadcn/ui (Radix) |
| **Routing** | React Router v6 (SPA client-side) |
| **State (global)** | Zustand 5 (UI state) + TanStack Query v5 (server state) |
| **Validation** | Zod 3.23 |
| **Icons** | lucide-react 1.17 |
| **Rich text** | Tiptap 3.25 (ProseMirror) |
| **Notifications** | Sonner 2.0 (toast) |
| **Backend** | MockAPI (dev) + Supabase (live) + Firebase |
| **PDF** | react-pdf 9.2 + pdfjs-dist 4.8.69 |
| **Crypto** | TweetNaCl (Secret notes) |

---

## 📂 Cấu Trúc Thư Mục

```
src/
├── main.tsx                    # Entry: React Query + Router + Toaster
├── App.tsx                     # Routes + Global modals
│
├── routes/                     # Pages (1 file = 1 route, lazy loaded)
│   ├── HubPro.tsx             # Home với Focus Layer
│   ├── Notes.tsx              # Note manager
│   ├── Tasks.tsx              # Task/List manager
│   ├── Movies.tsx             # Movie tracker
│   ├── Expense.tsx            # Expense tracker
│   ├── Keycap.tsx             # Keycap speculation tools
│   ├── ProjectPacker.tsx      # ZIP packer + analyzer
│   ├── P2PTransfer.tsx        # P2P (PeerJS)
│   ├── CodeCompare.tsx        # Code comparison
│   ├── Sources.tsx            # Browser sources
│   ├── Setting.tsx            # User settings
│   └── reader/                # PDF reader module
│       ├── Reader.tsx         # Main reader page
│       ├── ReaderApp.tsx      # Sub-routes
│       └── ...
│
├── components/
│   ├── ui/                    # shadcn primitives (Button, Input, Dialog, Tabs, Checkbox, Tooltip...)
│   ├── reader/                # PDF reader components (PdfReader, ReaderHeader, HighlightList...)
│   ├── keycap/                # Keycap-specific UI
│   ├── expense/               # Expense tracker UI
│   ├── movies/                # Movies UI
│   ├── packer/                # Packer UI
│   ├── sources/               # Sources UI
│   ├── NoteEditor.tsx         # Rich text note editing
│   ├── NoteList.tsx           # Note list
│   ├── RichEditor.tsx         # Tiptap wrapper
│   ├── TaskList.tsx           # Task list
│   ├── TaskSidebar.tsx        # Task filter sidebar
│   ├── FocusLayer.tsx         # Focus mode (HubPro)
│   ├── MobileHeader.tsx       # Mobile nav
│   ├── Sidebar.tsx            # Legacy (deprecated)
│   ├── ToolModal.tsx          # Dialog wrapper
│   ├── ToolButton.tsx         # Hub grid button
│   ├── ToolIcon.tsx           # Icon map
│   ├── LinkedNotesPicker.tsx  # Modal chọn linked notes
│   ├── ShortcutManager.tsx    # Shortcut UI
│   └── ...
│
├── modals/                    # Global modals (mount ở App level)
│   ├── Calculator.tsx
│   ├── Translate.tsx
│   ├── Encoder.tsx
│   ├── Backup.tsx
│   ├── Secret.tsx
│   ├── Savings.tsx
│   ├── Spx.tsx               # SPX tracking
│   ├── DailyReminder.tsx
│   ├── Shortcuts.tsx
│   ├── Crypto.tsx
│   └── CacheInspector.tsx
│
├── stores/                    # Zustand stores (global state)
│   ├── modalStore.ts         # Modal mở/đóng
│   ├── shortcutStore.ts      # Shortcut registry
│   └── cryptoStore.ts        # Crypto state
│
├── api/                       # TanStack Query hooks
│   ├── client.ts             # fetch wrapper
│   ├── notes.ts              # Note CRUD + optimistic UI
│   ├── tasks.ts              # Task CRUD
│   ├── movies.ts             # Movie CRUD
│   ├── expense.ts            # Expense CRUD
│   ├── keycap.ts             # Keycap CRUD
│   ├── savings.ts            # Savings CRUD
│   ├── setting.ts            # Settings CRUD
│   ├── shortcutOverrides.ts  # Shortcut custom bindings
│   ├── toolCategories.ts     # Hub categories
│   └── reader/               # Reader API (Supabase auth + storage)
│
├── hooks/                     # Custom React hooks
│   ├── useGlobalShortcuts.ts # Global keydown listener
│   ├── useBootstrapShortcutOverrides.ts
│   ├── useToolAction.ts      # Tool open/execute
│   ├── useLocalStorage.ts    # Persist state
│   ├── useSessionStorage.ts  # Session-only state
│   ├── useDebouncedEffect.ts # Debounced side effect
│   └── useFlipAnimation.ts   # Card flip animation
│
├── lib/                       # Pure utilities (no React)
│   ├── config.ts             # API URLs (env decode)
│   ├── cn.ts                 # clsx + twMerge
│   ├── optimistic.ts         # Optimistic UI helper + beforeunload guard
│   ├── tools.ts              # Tool registry (icon, label, shortcut)
│   ├── focus.ts              # Focus algorithm (pie slice)
│   ├── taskFilters.ts        # Filter + sort tasks
│   ├── backup.ts             # Export/import JSON
│   ├── cacheInspect.ts       # LocalStorage inspection
│   ├── cryptoFields.ts       # Encrypted field registry
│   ├── secretCrypto.ts       # TweetNaCl wrapper
│   ├── appSecret.ts          # App secret management
│   │
│   ├── movies.ts             # Movie types + helpers
│   ├── savings.ts            # Savings types + helpers
│   ├── expense.ts            # Expense types + logic
│   ├── expenseParser.ts      # Chat → expense parser
│   ├── moneyParse.ts         # "35k" → 35000
│   ├── setting.ts            # Setting types + helpers
│   ├── settingGroups.ts      # Setting UI structure
│   │
│   ├── keycap/               # Keycap domain
│   │   ├── types.ts
│   │   ├── lotMath.ts        # Lot math (profit/loss)
│   │   ├── calc.ts           # Calculations
│   │   └── expenseSync.ts    # Sync expense tracker
│   │
│   ├── packer/               # Project packer domain
│   │   ├── types.ts
│   │   ├── format.ts         # File tree format
│   │   ├── filter.ts         # File filter rules
│   │   ├── presets.ts        # Default configs
│   │   ├── pack.ts           # Packing logic
│   │   ├── unpack.ts         # Unpacking logic
│   │   └── analyze.ts        # Tree analysis
│   │
│   ├── p2p/                  # P2P transfer
│   │   ├── types.ts
│   │   └── peer.ts           # PeerJS wrapper
│   │
│   ├── editor/               # Tiptap extensions
│   │   └── VocabBlock.tsx    # Custom node
│   │
│   └── reader/               # PDF reader utilities
│       ├── pdfjs-setup.ts    # PDFjs worker
│       ├── blob-cache.ts     # IndexedDB cache (LRU)
│       ├── highlights.ts     # Highlight logic
│       └── search.ts         # PDF search
│
├── schemas/                   # Zod validation schemas
│   ├── note.ts               # Note + parseNotes
│   └── task.ts               # Task + parseTasks
│
└── styles/
    ├── index.css             # Tailwind + CSS theme vars
    └── editor.css            # Tiptap custom styles
```

---

## 🎨 Theme & Styling

### Hệ Thống Theme Token (CSS Variables)

App dùng **token-based theme** qua CSS variables định nghĩa trong `src/styles/index.css`, mapping ra Tailwind class trong `tailwind.config.ts`.

#### Theme hiện tại: Dark VSCode

```css
:root {
  --background: 0 0% 12%;          /* #1e1e1e */
  --foreground: 0 0% 83%;          /* #d4d4d4 */
  --primary: 204 100% 40%;         /* #007acc - VSCode blue */
  --card: 240 1% 15%;              /* #252526 */
  --popover: 240 2% 18%;           /* #2d2d30 */
  --muted: 240 2% 20%;             /* Hover bg */
  --accent: 204 100% 40%;          /* Same as primary */
  --destructive: 358 64% 51%;      /* #d13438 - Red */
  --border: 240 4% 25%;            /* #3e3e42 */
}
```

#### Quy Tắc Khi Viết UI

1. **Ưu tiên semantic token**:
   - `bg-primary`, `text-primary`, `border-border`
   - `bg-card`, `bg-popover`, `text-foreground`, `text-muted-foreground`
   - `focus:border-ring`, `border-input`, `bg-destructive`

2. **Tránh hard-code shade Tailwind**:
   - ❌ `bg-blue-500`, `text-emerald-400`, `border-sky-600` (khó đổi theme sau)
   - ✅ `bg-primary`, `text-primary`, `border-border` (dùng token)

3. **Alpha modifier OK**:
   - `bg-primary/15`, `border-primary/40`, `text-primary/80` — vẫn follow token

4. **Zinc/neutral được phép**:
   - Reader chrome (header, sidebar) — intentional dark
   - Border phụ rất nhạt
   - Còn lại: dùng `border`, `card`, `popover`, `muted`

5. **Highlight color (user data)** — hard-code:
   - Yellow/Blue/Green/Red trong note highlight → data user, không phải theme

#### Khi User Yêu Cầu "Đổi Theme"

- KHÔNG tìm-thay từng class shade (emerald-500 → sky-500) — sẽ phải làm lại lần sau
- Đề xuất switch sang token + sửa CSS var trong `src/styles/index.css`
- Nếu user muốn chữa cháy nhanh → làm nhưng note trade-off

#### borderRadius = 0 Tuyệt Đối

App giữ **vuông vức** (không có rounded corner):

```ts
// tailwind.config.ts
borderRadius: {
  none: '0',
  DEFAULT: '0',
  sm: '0',
  md: '0',
  lg: '0',
  xl: '0',
  full: '0',
},
```

shadcn components vẫn render OK vì dùng CSS variables.

---

## 🔄 Data Flow & State Management

### 1. **Server State (TanStack Query)**

Tất cả data từ API (notes, tasks, movies...) đi qua TanStack Query:

```
User action (click/type/submit)
    ↓
Component hook: useNotes(), useCreateNote()...
    ↓
TanStack Query mutation/query
    ↓
fetch(API_URL) → Zod.parse() → validate + transform
    ↓
Cache store → Component re-render
```

**Ưu điểm**: Tự động dedup requests, background refetch, stale handling.

### 2. **UI State (Zustand)**

Trạng thái UI toàn app (modal mở, shortcut, settings):

```
Component: useModalStore((s) => s.open)
    ↓
Zustand store (in-memory)
    ↓
Trigger action: store.open('calculator')
    ↓
Subscription → component re-render
```

**Ưu điểm**: Đơn giản, performance tốt, không qua Context.

### 3. **Local State (useState)**

Temp UI state (form input, toggle, animation):

```
const [isOpen, setIsOpen] = useState(false);
const [input, setInput] = useState('');
```

### 4. **Persistent State (useLocalStorage)**

Lưu across browser session:

```
const [selectedNoteId, setSelectedNoteId] = useLocalStorage('selectedNoteId', null);
```

---

## ⚡ Optimistic UI Pattern

Tất cả mutations dùng **optimistic update** để UI react ngay:

```ts
// lib/optimistic.ts helper
useMutation({
  mutationFn: async (input) => { ... },
  ...optimisticList(qc, ['notes'], (old, input) => {
    // Update cache ngay
    return [newItem, ...old];
  }),
})
```

**Flow**:
1. `onMutate`: Update cache ngay (UI renders)
2. API call background
3. Fail → `onError`: Rollback snapshot
4. Success → `onSettled`: Refetch để sync

**beforeunload guard**: Nếu có pending mutations, cảnh báo khi user rời trang.

---

## 🚀 Code Splitting

Routes lazy-loaded bằng `React.lazy()`:

| Chunk | Size | Lazy? |
|-------|------|-------|
| Initial (React + Router + modals) | ~145KB | - |
| Notes (Tiptap) | ~130KB | ✅ |
| Tasks/Movies/Expense | 3-7KB | ✅ |
| JSZip (Packer) | 30KB | ✅ dynamic import |

Initial bundle nhẹ → fast first paint.

---

## 🧩 Common Patterns & Components

### Modal Pattern (Global Modals)

Tất cả modal global mount ở `App.tsx`:

```tsx
// stores/modalStore.ts
const useModalStore = create((set) => ({
  current: null,
  open: (id) => set({ current: id }),
  close: () => set({ current: null }),
}));

// App.tsx
<Calculator />
<Translate />
<Encoder />
// ... etc
```

Bất kỳ component nào cũng mở modal:
```tsx
const { open } = useModalStore();
<button onClick={() => open('calculator')}>Open Calculator</button>
```

### Shortcut System (Global Keyboard Listener)

`useGlobalShortcuts` ở `App.tsx` lắng nghe toàn bộ keydown:

```ts
// stores/shortcutStore.ts
const shortcuts = new Map([
  ['ctrl+k', { handler: () => open('calculator') }],
  ['alt+t', { handler: () => open('translate') }],
]);

// hooks/useGlobalShortcuts.ts
function useGlobalShortcuts() {
  useEffect(() => {
    const handler = (e) => {
      const key = normalizeKey(e);  // 'ctrl+k'
      const shortcut = shortcuts.get(key);
      if (shortcut) shortcut.handler();
    };
    window.addEventListener('keydown', handler);
  }, [shortcuts]);
}
```

**Lợi**: Shortcut riêng mà config global, component tách biệt.

### API & Query Pattern

```ts
// api/notes.ts
export function useNotes() {
  return useQuery({
    queryKey: ['notes'],
    queryFn: fetchNotes,  // throw nếu error
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => { /* POST */ },
    ...optimisticList(qc, ['notes'], updater),
  });
}

// Component
const { data: notes } = useNotes();
const create = useCreateNote();
create.mutate({ title: '...' });
```

**Lợi**: Tự động cache + dedup, optimistic UI, background refetch.

### Component Structure

**Page (route)**:
```tsx
export default function NotesPage() {
  const { data: notes } = useNotes();
  return (
    <div>
      <NoteList notes={notes} />
      <NoteEditor />
    </div>
  );
}
```

**Reusable Component**:
```tsx
interface NoteListProps {
  notes: Note[];
  onSelect: (id: string) => void;
}
export default function NoteList({ notes, onSelect }: NoteListProps) {
  return (
    <div>
      {notes.map((n) => (
        <div key={n.id} onClick={() => onSelect(n.id)}>
          {n.title}
        </div>
      ))}
    </div>
  );
}
```

**Lợi**: Dễ test, reusable, clear props.

---

## 📝 Coding Standards

### File Naming

| Loại | Pattern | Ví dụ |
|------|---------|-------|
| Page/route | PascalCase | `Notes.tsx`, `HubPro.tsx` |
| Component | PascalCase | `NoteEditor.tsx`, `ItemCard.tsx` |
| Hook | camelCase + `use` | `useLocalStorage.ts` |
| Store | camelCase + `Store` | `modalStore.ts` |
| Util/lib | camelCase | `focus.ts`, `cn.ts` |
| Folder | kebab-case | `keycap/`, `packer/` |

### TypeScript Strict

```ts
// ✅ OK
const cn: string = 'px-2';
const items: Note[] = [];
interface Props { title: string; }

// ❌ KHÔNG
const cn: any = 'px-2';  // ← any bị ban
function process(data: any) {}
```

**Bị bắt**: `noUnusedLocals`, `noUnusedParameters`, `noImplicitAny`, `strict`.

### Import Order

```ts
// 1. React + third-party
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal hooks, stores
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useModalStore } from '@/stores/modalStore';

// 3. Internal lib utils
import { cn } from '@/lib/cn';
import { optimisticList } from '@/lib/optimistic';

// 4. Components (shadcn first)
import { Button } from '@/components/ui/button';
import { NoteList } from '@/components/NoteList';

// 5. Types
import type { Note } from '@/schemas/note';
```

### Comment Style

- **Giải thích logic**: Tiếng Việt
- **Patterns**: Tiếng Anh (ecosystem)
- **Usefulness sections**: `// ============================================================`

```ts
// ============================================================
// useEffect explanation — giải thích cho dev yếu React
// ============================================================
useEffect(() => {
  // Bắt lắng nghe shortcut toàn app
  const handler = (e) => { ... };
  window.addEventListener('keydown', handler);
  
  // Cleanup: xoá listener khi component unmount
  return () => window.removeEventListener('keydown', handler);
}, [shortcuts]);  // Deps: re-run nếu shortcuts thay đổi
```

---

## 🆕 Hướng Dẫn: Tạo Feature Mới

### Ví dụ: Thêm Tool "Note Snippets"

#### Step 1: Tạo API Hook

```ts
// src/api/snippets.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import { API } from '@/lib/config';

export interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
}

export function useSnippets() {
  return useQuery({
    queryKey: ['snippets'],
    queryFn: () => fetchJson<Snippet[]>(API.SNIPPETS),
  });
}

export function useCreateSnippet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Snippet, 'id'>) =>
      fetchJson<Snippet>(API.SNIPPETS, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    ...optimisticList(qc, ['snippets'], (old, input) => [
      { ...input, id: 'temp_' + Date.now() },
      ...old,
    ]),
  });
}
```

#### Step 2: Tạo Route Page

```tsx
// src/routes/Snippets.tsx
import { useSnippets, useCreateSnippet } from '@/api/snippets';

export default function SnippetsPage() {
  const { data: snippets, isLoading } = useSnippets();
  const create = useCreateSnippet();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Snippets</h1>
      <button
        onClick={() => create.mutate({ title: 'New', code: '', language: 'ts' })}
      >
        Add Snippet
      </button>
      <div className="grid gap-2">
        {snippets?.map((s) => (
          <div key={s.id} className="border border-border p-2">
            {s.title}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Step 3: Thêm Route

```tsx
// App.tsx
const Snippets = lazy(() => import('./routes/Snippets'));

<Routes>
  {/* ... */}
  <Route path="/snippets" element={<Snippets />} />
</Routes>
```

#### Step 4: Thêm vào Tool Registry

```ts
// lib/tools.ts
export const TOOLS = [
  // ... existing
  {
    id: 'snippets',
    label: 'Snippets',
    icon: 'Code',
    shortcut: 'alt+n',
    route: '/snippets',
  },
];
```

---

## 📚 Base CSS & Utils

### cn() Helper (Tailwind + clsx)

```ts
import { cn } from '@/lib/cn';

// Merge class names + resolve Tailwind conflicts
const classes = cn(
  'px-2',
  condition && 'px-4',  // ← px-4 wins
  { 'bg-red': isError }
);
// Result: 'px-4 bg-red'
```

### Text Truncation Classes

```tsx
// 1 dòng
<div className="truncate">Long text...</div>

// N dòng
<div className="line-clamp-3">Multi-line text...</div>

// Custom (CSS)
<div style={{ WebkitLineClamp: 5 }} className="line-clamp-5">...</div>
```

### Flex Alignment Shortcuts

```tsx
// Center both axes
<div className="flex items-center justify-center">Content</div>

// Space between
<div className="flex items-center justify-between">Left | Right</div>

// Inline center
<div className="inline-flex items-center gap-2">Icon + Text</div>
```

### Focus Ring Pattern

```tsx
<button className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
  Accessible button
</button>
```

---

## 🔒 Security Best Practices

1. **Environment variables** — API URLs ở `lib/config.ts`, decode từ `window.__CONFIG__`
2. **Zod validation** — Parse + validate tất cả data từ API
3. **XSS prevention** — React auto-escape, TipTap sanitize HTML
4. **CSRF** — Supabase handles (auth token ở header)
5. **Secrets** — Encrypted via TweetNaCl, stored ở `Secret` modal

---

## 🧪 Testing (TBD)

Chưa có test setup. Khi thêm:
- **Framework**: Vitest (compat với Vite)
- **React testing**: React Testing Library
- **E2E**: Playwright hoặc Cypress

---

## 🚀 Build & Deploy

### Local Development

```bash
npm install
npm run dev
# → http://localhost:3000
```

### Build Production

```bash
npm run build
# → dist/ (Vite bundled, tsc checked)
```

### Lint & Format

```bash
npm run lint       # ESLint
npm run format     # Prettier
```

---

## 🎯 Reader Module Architecture (PDF Reader)

Reader là **module độc lập** trong BiBo Tools, có route riêng (`/reader/*`).

### Cấu Trúc Reader

```
src/
├── routes/reader/
│   ├── Reader.tsx          # Main reader page
│   ├── ReaderApp.tsx       # Sub-routes (library, book detail...)
│   └── ...
│
├── api/reader/             # Supabase auth + storage APIs
│   ├── auth.ts
│   ├── books.ts
│   ├── highlights.ts
│   └── ...
│
├── components/reader/      # Reader UI components
│   ├── PdfReader.tsx       # PDF canvas + controls
│   ├── ReaderHeader.tsx    # Top bar (title, zoom, search)
│   ├── ReaderSidebar.tsx   # Sidebar toggle
│   ├── HighlightList.tsx   # Highlights panel
│   ├── TocList.tsx         # Table of contents
│   ├── PdfSearchTab.tsx    # Search tab
│   ├── SettingsDropdown.tsx# Theme (light/dark/sepia)
│   ├── ProgressBar.tsx     # Page progress
│   ├── BookCover.tsx       # Book cover
│   ├── EdgeClickZones.tsx  # Page flip zones
│   ├── SelectionMenu.tsx   # Highlight context menu
│   ├── TranslatePopover.ts # Quick translate
│   ├── UploadProgressPanel.tsx
│   └── ReaderSkeleton.tsx  # Loading skeleton
│
└── lib/reader/             # Reader utilities
    ├── pdfjs-setup.ts      # PDFjs worker init
    ├── blob-cache.ts       # IndexedDB cache (LRU eviction)
    ├── highlights.ts       # Highlight calc + storage
    ├── search.ts           # PDF search logic
    └── ...
```

### Key Features

**Canvas Rendering**:
- Dùng `react-pdf` (pdfjs-dist backend)
- Worker setup ở `lib/reader/pdfjs-setup.ts`
- Zoom + page navigation

**Caching**:
- IndexedDB LRU cache cho PDF file + cover (`lib/reader/blob-cache.ts`)
- Tránh re-download same PDF

**Highlights & Notes**:
- User highlight → Supabase storage
- Stored as JSON (position, color, text)
- Read từ `highlights.ts` API hook

**Theme (Light/Dark/Sepia)**:
- Canvas filter: `invert(1) hue-rotate(180deg)` (dark)
- CSS var selector: `[data-pdf-theme='dark']`
- Text layer giữ transparent (lấy selection từ canvas)

**Search**:
- Dùng pdfjs.Page.getTextContent()
- Highlight matches trên canvas

---

## 🔗 Linking Components Across Modules

### Shared Patterns

1. **Modal từ component khác**:
   ```tsx
   import { useModalStore } from '@/stores/modalStore';
   
   export default function NoteEditor() {
     const { open } = useModalStore();
     return <button onClick={() => open('translator')}>Dịch</button>;
   }
   ```

2. **Global shortcut từ anywhere**:
   ```tsx
   import { useShortcutStore } from '@/stores/shortcutStore';
   
   useEffect(() => {
     useShortcutStore.getState().register({
       key: 'alt+e',
       handler: () => console.log('Export!'),
     });
   }, []);
   ```

3. **Query data từ multiple sources**:
   ```tsx
   const { data: notes } = useNotes();
   const { data: tasks } = useTasks();
   // Both cached independently
   ```

---

## 🐛 Debugging Tips

### 1. React DevTools

- Profiler: detect wasteful re-renders
- Component tree: inspect props, state

### 2. TanStack Query DevTools

```tsx
// main.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<ReactQueryDevtools />  // Auto mở trong dev
```

Xem cache, queries, mutations, requests.

### 3. Console

```ts
// Log active shortcuts
console.log(useShortcutStore.getState().shortcuts);

// Log modal state
console.log(useModalStore.getState().current);

// Inspect cache
console.log(queryClient.getQueryData(['notes']));
```

### 4. Network Tab

- Check API requests (MockAPI or live backend)
- Inspect response data
- Timing analysis

### 5. Local Storage

```ts
// Inspect persisted state
localStorage.getItem('selectedNoteId');
localStorage.getItem('taskFilters');
```

---

## 📦 Common Dependencies

### UI & Styling
- `tailwindcss` — Utility CSS
- `shadcn/ui` — Radix + CVA components
- `lucide-react` — Icons

### State & Fetch
- `zustand` — Global UI state
- `@tanstack/react-query` — Server state + cache

### Rich Text & Editors
- `@tiptap/react` — Rich editor framework
- `@tiptap/starter-kit` — Basic extensions
- `lowlight` — Code highlight

### PDF & Files
- `react-pdf` — PDF rendering
- `pdfjs-dist` — PDF parser engine
- `jszip` — ZIP handling

### Validation & Crypto
- `zod` — Schema validation
- `tweetnacl-js` — Encryption (Secret notes)

### Utilities
- `react-router-dom` — Routing
- `sonner` — Toast notifications
- `clsx` + `tailwind-merge` — CSS merging

---

## ✅ Quality Standards

### Before Committing

1. **TypeScript**: `npm run build` (tsc check)
2. **Linting**: `npm run lint`
3. **Formatting**: `npm run format`
4. **Manual test**: Local dev server
5. **No console.log** (trừ `eslint-disable-next-line no-console`)

### Before Opening PR

- Feature complete + working
- No breaking changes (nếu lớn → discuss first)
- Comment code phức tạp (Việt OK)
- Test flow: create, read, update, delete
- Mobile responsive (nếu cần)

---

## 📖 Further Reading

- `docs/conventions.md` — File naming, patterns, import order
- `docs/database.md` — Backend setup, Supabase integration
- `docs/optimistic-ui.md` — Detailed optimistic update pattern
- `docs/blob-cache.md` — IndexedDB caching strategy
- `docs/modal-system.md` — Modal architecture