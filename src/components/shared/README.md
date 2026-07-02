# `src/components/shared/` — Shared UI states

3 component chuẩn cho pattern lặp nhiều nhất: Loading, Empty, Error.

Rule enforcement ở `.kiro/steering/ui-patterns.md`.

## File

| File | Mục đích |
|---|---|
| `LoadingState.tsx` | Spinner / skeleton / inline loading |
| `EmptyState.tsx` | List rỗng / search không match / chưa có data |
| `ErrorState.tsx` | Query fail / mutation fail — có retry action |
| `index.ts` | Barrel export |

## Convention

- Import: `import { LoadingState, EmptyState, ErrorState } from '@/components/shared';`
- Semantic token only (`text-muted-foreground`, `bg-destructive/10`) — KHÔNG hard-code shade.
- Không tự viết `<Skeleton />` / `<div>Loading...</div>` / empty div inline. Nếu cần biến thể mới → thêm variant prop vào component ở đây, không viết lại inline.

## Khi nào KHÔNG dùng

- **Reader chrome** (canvas viewer, PDF toolbar) — có UX riêng, giữ custom.
- **Tính toán inline nhỏ** (loading spinner 1 icon trong button) — dùng `<LoadingState variant="inline" />` đúng rồi, không cần shared khác.