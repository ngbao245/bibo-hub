# `hooks/` — Custom React Hooks

Hook tái sử dụng. Convention: tên **`useCamelCase.ts`**, mỗi file 1 hook.

## Hook hiện có

### Shortcut

| Hook | Mô tả |
|---|---|
| `useShortcut.ts` | Đăng ký 1 shortcut vào `shortcutStore` (tự cleanup khi unmount). |
| `useGlobalShortcuts.ts` | Lắng nghe `keydown` toàn cục, gọi handler từ store. Chỉ dùng 1 lần ở `App.tsx`. |
| `useBootstrapShortcutOverrides.ts` | Load custom shortcut binding từ MockAPI lúc app khởi động. |

Chi tiết: [docs/modal-system.md](../../docs/modal-system.md).

### Tool action

| Hook | Mô tả |
|---|---|
| `useToolAction.ts` | Xử lý click button trên Hub (mở modal hoặc navigate route). |

### Persistence

| Hook | Mô tả |
|---|---|
| `useLocalStorage.ts` | State sync với `localStorage`, có cross-tab update. |
| `useSessionStorage.ts` | Tương tự nhưng dùng `sessionStorage` (tab-scoped). |

### Side effects

| Hook | Mô tả |
|---|---|
| `useDebouncedEffect.ts` | `useEffect` với debounce. Hay dùng cho auto-save (gõ → 800ms im → mutate). |
| `useFlipAnimation.ts` | FLIP technique cho card animation. |

### Editor

| Hook | Mô tả |
|---|---|
| `useTextareaLineShortcuts.ts` | VS Code style shortcuts cho `<textarea>` native: line ops (C/X/V/delete/move/duplicate), Tab indent, Ctrl+/ toggle comment, Ctrl+Enter insert line below/above. Dùng cho JSON Viewer editor. |

## Nguyên tắc

- Hook **không** giấu API call hay state phức tạp — nếu cần, dùng store hoặc TanStack Query.
- Deps array phải đủ. Nếu cố tình bỏ → comment lý do + `// eslint-disable-next-line react-hooks/exhaustive-deps`.
- Không wrap mọi function bằng `useCallback` — chỉ khi function được truyền xuống child memoized hoặc nằm trong deps.