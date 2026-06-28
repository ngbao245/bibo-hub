# ⚡ Quick Reference - BiBo Tools v2

Tóm tắt nhanh các key points.

---

## 🏗️ Folder Shortcuts

| Path | Purpose |
|------|---------|
| `src/routes/` | Page components (1 route = 1 file) |
| `src/components/` | Reusable UI components |
| `src/api/` | TanStack Query hooks |
| `src/stores/` | Zustand global stores |
| `src/lib/` | Utilities (pure functions) |
| `src/schemas/` | Zod validation + types |
| `src/hooks/` | Custom React hooks |
| `src/styles/` | CSS (theme tokens, Tailwind) |
| `src/modals/` | Global modals |

---

## 🔧 Key Commands

```bash
npm run dev       # Start dev server (Vite)
npm run build     # Build + type check (tsc -b && vite build)
npm run lint      # Check code (ESLint)
npm run format    # Format code (Prettier)
```

---

## 📝 File Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Page | `PascalCase.tsx` | `Notes.tsx` |
| Component | `PascalCase.tsx` | `NoteEditor.tsx` |
| Hook | `useCamelCase.ts` | `useLocalStorage.ts` |
| Store | `camelCaseStore.ts` | `modalStore.ts` |
| Util | `camelCase.ts` | `cn.ts`, `focus.ts` |
| Folder | `kebab-case/` | `keycap/`, `reader/` |

---

## 🎨 Theme Tokens (Always Use These)

```tsx
// Background
bg-background    // Main bg
bg-card          // Card surface
bg-popover       // Dropdown/modal bg
bg-muted         // Hover state

// Text
text-foreground           // Primary text
text-muted-foreground     // Secondary text

// Interactive
bg-primary / text-primary  // Main action, highlight
bg-destructive             // Delete, error

// Borders & Focus
border-border      // Standard border
focus:ring-2 ring-ring  // Focus indicator

// Modifiers
bg-primary/15      // Alpha opacity (15%)
```

❌ **NEVER** hard-code Tailwind shades (`bg-blue-500`, `text-green-400`).

---

## 🔄 Common Import Patterns

```ts
// React + third-party
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

// Zustand store
import { useModalStore } from '@/stores/modalStore';

// API hooks
import { useNotes, useCreateNote } from '@/api/notes';

// Utils
import { cn } from '@/lib/cn';
import { optimisticList } from '@/lib/optimistic';

// shadcn UI
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Icons
import { Plus, Trash2, Edit } from 'lucide-react';

// Types
import type { Note } from '@/schemas/note';
```

---

## 📋 API Hook Pattern

```ts
// Query
export function useFoos() {
  return useQuery({
    queryKey: ['foos'],
    queryFn: () => fetchJson<Foo[]>(API.FOOS),
  });
}

// Mutation (with optimistic UI)
export function useCreateFoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FooInput) => 
      fetchJson<Foo>(API.FOOS, { method: 'POST', body: JSON.stringify(input) }),
    ...optimisticList(qc, ['foos'], (old, input) => [newItem, ...old]),
    onSuccess: () => toast.success('Done!'),
    onError: () => toast.error('Failed'),
  });
}
```

---

## 🧩 Component Template

```tsx
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface MyComponentProps {
  title: string;
  onClose?: () => void;
  isActive?: boolean;
}

export default function MyComponent({
  title,
  onClose,
  isActive,
}: MyComponentProps) {
  return (
    <div className={cn('flex flex-col gap-4', isActive && 'bg-primary')}>
      <h2 className="text-lg font-bold">{title}</h2>
      <Button onClick={onClose}>Close</Button>
    </div>
  );
}
```

---

## 🚀 Adding New Feature (Quick Steps)

1. **Schema**: `src/schemas/feature.ts` (Zod)
2. **API**: `src/api/feature.ts` (TanStack Query hooks)
3. **Route**: `src/routes/Feature.tsx` (page component)
4. **Register**: Add to `src/App.tsx` routes
5. **Tool**: Add to `src/lib/tools.ts`
6. **Test**: CRUD operations work

See `docs/ADDING_NEW_FEATURE.md` for detailed example.

---

## 📱 Responsive Grid

```tsx
// 1 col mobile, 2 cols tablet, 3 cols desktop
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
  {items.map((item) => <Item key={item.id} {...item} />)}
</div>
```

---

## ⌨️ Keyboard Shortcuts

```ts
// Register shortcut in component
useEffect(() => {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  });
}, []);

// Or use global shortcut system
useShortcutStore.getState().register({
  key: 'ctrl+s',
  handler: handleSave,
});
```

---

## 💾 LocalStorage Usage

```ts
import { useLocalStorage } from '@/hooks/useLocalStorage';

// Persist state
const [selectedId, setSelectedId] = useLocalStorage('selected-id', null);

// Auto-sync between tabs
// (localStorage events trigger updates)
```

---

## 🔐 Validation (Zod)

```ts
import { z } from 'zod';

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title required'),
  content: z.string().optional(),
});

export type Note = z.infer<typeof NoteSchema>;

// Usage
const result = NoteSchema.safeParse(data);
if (!result.success) {
  console.error(result.error.errors);
}
```

---

## 🎯 Modal Pattern

```tsx
// Open modal from anywhere
const { open } = useModalStore();
<button onClick={() => open('calculator')}>Open</button>

// Modal component
import { ToolModal } from '@/components/ToolModal';

<ToolModal id="calculator" title="Calculator">
  <CalculatorContent />
</ToolModal>
```

---

## 🔔 Toast Notifications

```ts
import { toast } from '@/components/ui/sonner';

toast.success('Saved!');
toast.error('Error occurred');
toast.info('Info message');
toast.loading('Loading...');
```

---

## ✨ Common CSS Patterns

```tsx
// Center container
<div className="flex items-center justify-center">

// Space between
<div className="flex justify-between">

// Flex column
<div className="flex flex-col gap-4">

// Grid
<div className="grid grid-cols-3 gap-2">

// Truncate text
<div className="truncate">Long text...</div>

// Line clamp
<div className="line-clamp-3">Multi-line...</div>

// Opacity
<div className="opacity-50">Dimmed</div>

// Hover state
<div className="hover:bg-muted cursor-pointer">Clickable</div>

// Focus ring
<button className="focus:ring-2 focus:ring-ring">Focusable</button>
```

---

## 🐛 Debug Tips

```ts
// React DevTools
// Profiler → identify wasteful re-renders

// TanStack Query DevTools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
<ReactQueryDevtools />

// Store state
console.log(useModalStore.getState());

// Cache
const qc = useQueryClient();
console.log(qc.getQueryData(['notes']));

// LocalStorage
localStorage.getItem('selectedId');
```

---

## 📚 Key Files to Know

| File | Purpose |
|------|---------|
| `src/App.tsx` | Route + global modals |
| `src/main.tsx` | Entry + providers |
| `src/styles/index.css` | Theme tokens + base CSS |
| `tailwind.config.ts` | Tailwind config + token mapping |
| `src/lib/cn.ts` | CSS class merge helper |
| `src/lib/optimistic.ts` | Optimistic UI pattern |
| `src/stores/modalStore.ts` | Global modal state |
| `src/hooks/useGlobalShortcuts.ts` | Keyboard listener |

---

## 🎁 Bonus: Component Library

**shadcn/ui components** ready to use:

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
```

---

## 🚫 Common Mistakes to Avoid

| ❌ Wrong | ✅ Right |
|---------|----------|
| `bg-blue-500` | `bg-primary` |
| Hard-coded colors | Use theme tokens |
| `any` type | Proper types + Zod |
| Multiple copies of data | Single source (TanStack Query) |
| Manual re-fetching | `invalidateQueries` |
| `useCallback` everywhere | Only when needed |
| Spread state in form | Controlled inputs |
| No error handling | Toast + try/catch |
| Scrollbar visible | `::-webkit-scrollbar { display: none; }` |
| Prop drilling deep | Use Zustand for global state |

---

## 📖 Documentation Structure

- `docs/PROJECT_ARCHITECTURE.md` — Full architecture overview
- `docs/BASE_CSS_COMPONENTS.md` — CSS, theme, components guide
- `docs/ADDING_NEW_FEATURE.md` — Step-by-step feature addition
- `docs/QUICK_REFERENCE.md` — This file
- `docs/conventions.md` — Coding standards
- `docs/database.md` — Backend setup
- `docs/optimistic-ui.md` — Detailed optimistic pattern
- `docs/blob-cache.md` — IndexedDB strategy (Reader module)
- `docs/modal-system.md` — Modal architecture