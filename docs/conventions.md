# Coding Conventions

## File Naming

| Type | Pattern | Example |
|---|---|---|
| Page/route | PascalCase | `Notes.tsx`, `HubPro.tsx` |
| Component | PascalCase | `NoteEditor.tsx`, `ItemCard.tsx` |
| Hook | camelCase, prefix `use` | `useLocalStorage.ts` |
| Store | camelCase, suffix `Store` | `modalStore.ts` |
| Lib/utility | camelCase | `focus.ts`, `moneyParse.ts` |
| Types-only file | camelCase | `types.ts` |
| Folder for feature | kebab-case | `keycap/`, `packer/` |

## Component Patterns

### Page (route)
- Export `default function PageName()`
- Chứa layout + data fetching hooks + sub-components inline
- Nếu page lớn: tách sub-components ra file riêng trong `components/{feature}/`

### Reusable component
- Export `default function ComponentName(props)`
- Props interface define ngay trên component
- Không fetch data trong component — nhận qua props

### Modal
- Xem [modal-system.md](./modal-system.md)

## State Management

| Scope | Tool | When |
|---|---|---|
| Component local | `useState` | Form input, toggle, temp UI |
| Persist across visits | `useLocalStorage` | Selected note ID, filter choice |
| Share across components | Zustand store | Modal state, shortcuts |
| Server data | TanStack Query | API data (notes, tasks...) |

## API Hooks

Pattern:
```ts
export function useThings() {
  return useQuery({ queryKey: ['things'], queryFn: fetchThings });
}

export function useCreateThing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => { ... },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['things'] }),
  });
}
```

- `queryKey` là cache key. Mọi component dùng cùng key share cache.
- Sau mutation success: `invalidateQueries` → TanStack Query tự refetch.

## Styling

- Tailwind classes inline trên JSX
- `cn()` helper để merge conditional classes
- shadcn components cho UI primitives (Button, Input, Dialog, Tabs, Checkbox, Skeleton, Tooltip)
- Theme tokens dùng CSS variables (HSL) define trong `styles/index.css`
- **borderRadius = 0 tuyệt đối** (theme override trong tailwind.config)
- Dark mode only (không có light mode toggle)

## TypeScript

- Strict mode ON
- `noUnusedLocals`, `noUnusedParameters` ON
- Interface cho props, type cho unions/schemas
- Zod schema → `z.infer<typeof Schema>` cho types từ API
- Discriminated unions qua `type` field (Note types, Task vs List)

## Error Handling

- API errors: TanStack Query `onError` callback → toast.error()
- Parse errors: Zod `safeParse` → skip invalid records silently
- File read errors: catch → skip file, log to terminal

## Comments

- Comment tiếng Việt cho giải thích business logic
- Comment tiếng Anh cho technical patterns (vì ecosystem)
- `// 📚 GIẢI THÍCH` prefix cho useEffect/hook explanations (giúp dev yếu React hiểu)
- Section separator: `// ============================================================`

## Import Order

1. React/third-party libraries
2. Blank line
3. Internal: hooks, stores
4. Internal: lib utilities
5. Blank line
6. Components (shadcn ui first, then custom)
7. Types (import type)

## Testing

- Chưa có test framework setup
- Nếu cần: đề xuất Vitest + React Testing Library
