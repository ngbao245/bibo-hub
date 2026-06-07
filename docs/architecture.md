# Architecture

## Stack

| Layer | Tech |
|---|---|
| Build | Vite 6 |
| UI | React 18 + TypeScript strict |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives) |
| Routing | React Router v6 (SPA, client-side) |
| State (global) | Zustand 5 |
| Data fetching | TanStack Query v5 |
| Validation | Zod |
| Icons | lucide-react |
| Rich text | Tiptap (ProseMirror) |
| Toast | Sonner |

## Folder Structure

```
src/
├── main.tsx              # Entry: React Query + Router + TooltipProvider + Toaster
├── App.tsx               # Routes (lazy) + Global modals mount
│
├── routes/               # Page components (1 file = 1 route, lazy loaded)
│   ├── Hub.tsx           # / — bản original
│   ├── HubPro.tsx        # /pro — bản redesigned + Focus Layer
│   ├── Notes.tsx         # /notes
│   ├── Tasks.tsx         # /tasks
│   ├── Sources.tsx       # /sources
│   ├── Movies.tsx        # /movies
│   ├── Expense.tsx       # /expense
│   ├── Keycap.tsx        # /keycap
│   └── ProjectPacker.tsx # /project-packer
│
├── components/           # Reusable UI components
│   ├── ui/               # shadcn primitives (Button, Input, Dialog, Tooltip...)
│   ├── FocusLayer.tsx    # Focus section trên HubPro
│   ├── NoteEditor.tsx    # Rich text editor cho Notes
│   ├── NoteList.tsx
│   ├── RichEditor.tsx    # Tiptap wrapper
│   ├── Sidebar.tsx       # Shared sidebar (deprecated, dùng inline)
│   ├── ToolModal.tsx     # Bridge: shadcn Dialog + useModalStore
│   ├── ToolButton.tsx    # Hub original grid button
│   ├── ToolIcon.tsx      # Lucide icon map
│   ├── MobileHeader.tsx
│   ├── Modal.tsx         # Deprecated (tự build, giữ cho reference)
│   ├── keycap/           # Keycap-specific components
│   ├── movies/
│   ├── expense/
│   ├── sources/
│   ├── packer/
│   └── cache/            # Cache Inspector tabs
│
├── modals/               # Global modals (mount ở App level)
│   ├── Calculator.tsx
│   ├── Translate.tsx
│   ├── Encoder.tsx
│   ├── Backup.tsx
│   ├── Secret.tsx
│   ├── Savings.tsx
│   ├── Spx.tsx           # (file tên Spx vì SpxTracking bị IDE wipe)
│   ├── DailyReminder.tsx
│   ├── Shortcuts.tsx
│   └── CacheInspector.tsx
│
├── stores/               # Zustand stores
│   ├── modalStore.ts     # Modal nào đang mở
│   └── shortcutStore.ts  # Registry phím tắt
│
├── api/                  # TanStack Query hooks (fetch + cache)
│   ├── client.ts         # fetchJson wrapper
│   ├── notes.ts
│   ├── tasks.ts
│   ├── movies.ts
│   ├── expense.ts
│   ├── keycap.ts
│   └── savings.ts
│
├── schemas/              # Zod schemas + TypeScript types
│   ├── note.ts
│   └── task.ts
│
├── hooks/                # Custom React hooks
│   ├── useGlobalShortcuts.ts
│   ├── useShortcut.ts
│   ├── useToolAction.ts
│   ├── useLocalStorage.ts
│   └── useDebouncedEffect.ts
│
├── lib/                  # Pure utilities (no React)
│   ├── config.ts         # API URL decode
│   ├── cn.ts             # Tailwind class merge
│   ├── tools.ts          # Tool registry cho Hub
│   ├── focus.ts          # Focus algorithm
│   ├── movies.ts         # Movie types + helpers
│   ├── savings.ts        # Savings types + helpers
│   ├── expense.ts        # Expense types + date helpers
│   ├── expenseParser.ts  # Chat input → expense item
│   ├── moneyParse.ts     # "35k" → 35000
│   ├── secretCrypto.ts   # Encode/decode secret notes
│   ├── backup.ts         # Export/import logic
│   ├── taskFilters.ts    # Filter + sort tasks
│   ├── optimistic.ts     # Optimistic UI helper + beforeunload guard
│   ├── cacheInspect.ts   # LocalStorage inspection helpers
│   ├── keycap/           # Keycap domain logic
│   │   ├── types.ts
│   │   ├── lotMath.ts
│   │   ├── calc.ts
│   │   └── expenseSync.ts
│   ├── packer/           # Project Packer domain logic
│   │   ├── types.ts
│   │   ├── format.ts
│   │   ├── filter.ts
│   │   ├── presets.ts
│   │   ├── pack.ts
│   │   └── unpack.ts
│   └── editor/
│       └── VocabBlock.tsx # Tiptap custom node
│
└── styles/
    ├── index.css          # Tailwind + CSS vars (theme tokens)
    └── editor.css         # Tiptap editor styles
```

## Data Flow

```
User action (click/type/shortcut)
  ↓
Component (React)
  ↓
Hook (useCreateTask, useUpdateNote...)
  ↓
TanStack Query mutation → fetch(MockAPI)
  ↓
onSuccess → invalidateQueries(['tasks'])
  ↓
TanStack Query refetch → fetch(MockAPI)
  ↓
Zod parse (validate + transform)
  ↓
Component re-render với data mới
```

## Code Splitting

Routes lazy-loaded qua `React.lazy()`:
- Initial bundle: ~145KB gzip (React + Router + shadcn + modals)
- Notes chunk: ~130KB gzip (Tiptap heavy)
- Các page khác: 3-7KB gzip mỗi chunk
- JSZip: 30KB gzip (lazy import khi Unpack)

## Key Patterns

### 1. Modal Pattern (ToolModal)
```
useModalStore.open('calculator')  →  store.current = 'calculator'
                                         ↓
ToolModal id="calculator"  →  isOpen = current === 'calculator'
                                         ↓
shadcn Dialog open={isOpen}  →  render content
```

### 2. Shortcut Pattern (self-register)
```
Component mount → useShortcut({ key, handler })
                         ↓
shortcutStore.register(shortcut)  →  Map grows
                         ↓
Component unmount → cleanup → shortcutStore.unregister
```

### 3. Auto-save Pattern
```
User types → setState local → markDirty
                                  ↓
useDebouncedEffect (800ms) → mutation.mutate()
                                  ↓
onSuccess → setIsDirty(false)
```

### 4. Optimistic UI (TanStack Query)

Tất cả mutations dùng pattern này (xem [Optimistic UI](./optimistic-ui.md)).

```
User action → onMutate (update cache ngay)
                  ↓
            API call background
                  ↓
   error → onError (rollback snapshot)
   ok    → onSettled (invalidate + refetch sync)
```

Helper: `optimisticList(qc, queryKey, updater)` trong `lib/optimistic.ts`.

Kèm `beforeunload` warning khi pendingCount > 0.

### 5. Busy Message Pattern (chống treo UI)

Cho thao tác nặng (scan folder, build tree, tạo ZIP):
```ts
setBusyMessage('Đang xử lý...');
await new Promise(r => setTimeout(r, 0));  // yield render
// ... heavy work ...
setBusyMessage(null);
```

Render full-screen overlay với spinner + text mô tả.

### 6. Animated Progress Bar

Smooth tween bằng `requestAnimationFrame`:
```ts
function tick() {
  setDisplay(current => current + (target - current) * 0.08);
  raf = requestAnimationFrame(tick);
}
```

Bar không nhảy giật khi raw progress cập nhật chậm.
