# BiBo Tools v2 — Docs Index

Doc tổ chức 2 tầng: file trong `docs/` = doc high-level dùng chung. README trong `src/{folder}/` = co-located doc cho folder đó.

## Kiến trúc & convention

| File | Nội dung |
|---|---|
| [architecture.md](./architecture.md) | Stack, folder layout, data flow, code splitting, common patterns |
| [conventions.md](./conventions.md) | File naming, TypeScript, imports, comments |
| [adding-new-tool.md](./adding-new-tool.md) | Recipe thêm tool mới (route/modal) — case study Markdown Preview |
| [database.md](./database.md) | MockAPI + Supabase setup, env decode |
| [modal-system.md](./modal-system.md) | Modal store + ToolModal pattern |
| [optimistic-ui.md](./optimistic-ui.md) | Optimistic update + beforeunload guard |

Rule màu, theme token, code style hard rules → `.kiro/steering/system.md` (không copy sang docs/, avoid drift).

## Spec theo tool

| File | Tool |
|---|---|
| [audio.md](./audio.md) | Audio (audio-tool.md + audio-player.md deprecated) |
| [cache-inspector.md](./cache-inspector.md) | Cache Inspector |
| [expense-integration.md](./expense-integration.md) | Chi tiêu (Finance) |
| [focus-algorithm.md](./focus-algorithm.md) | Tasks — Focus Layer |
| [json-studio-performance.md](./json-studio-performance.md) | JSON Studio |
| [keycap-lot.md](./keycap-lot.md) | Compare (Keycap) |
| [pdf-reader.md](./pdf-reader.md) + [reader.md](./reader.md) + [reader-session-persist.md](./reader-session-persist.md) + [reader-vault-setup.md](./reader-vault-setup.md) | Reader |
| [project-packer.md](./project-packer.md) | Project Packer |
| [rag-integration-plan.md](./rag-integration-plan.md) | AI Search (RAG) |
| [setting-auth-refactor-plan.md](./setting-auth-refactor-plan.md) | Setting refactor plan (candidate-for-deprecation, chưa qua Pha 1) |
| [markdown-preview-research/](./markdown-preview-research/) | Markdown Preview — research lib gốc |

## Rule about docs

- Doc high-level (architecture, convention, cross-feature pattern) → `docs/`
- Doc gắn với 1 folder cụ thể → README.md trong folder đó (VD `src/lib/packer/README.md`)
- Naming: **kebab-case.md** cho tất cả doc mới. File cũ SNAKE_UPPER đã rename hết.
- Không tạo doc trùng chủ đề — 1 chủ đề = 1 file. Cập nhật thay vì tạo mới.