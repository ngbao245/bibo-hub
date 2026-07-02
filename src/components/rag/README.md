# `src/components/rag/` — RAG UI

UI cho module RAG (Retrieval Augmented Generation).

## Doc liên quan

- **[docs/rag-integration-plan.md](../../../docs/rag-integration-plan.md)** — spec đầy đủ.
- **[src/lib/rag/README.md](../../lib/rag/README.md)** — core logic.

## File

| File | Mô tả |
|---|---|
| `RagTokensManager.tsx` | Custom manager cho record `group=RAG, type=SettingInfor`. 3 Gemini key + 1 Groq key, encrypt khi save. Có nút Test mỗi key. |
| `RagConfigManager.tsx` | Custom manager cho record `group=RAG, type=Config`. Plaintext config: nguồn dữ liệu, chat mode, threshold, shortcut. Có nhúng `BackfillButton`. |
| `BackfillButton.tsx` | Manual reindex toàn bộ data: diff source ↔ rag_embeddings, enqueue embed/delete jobs. Progress bar + queue indicator. |
| `RagAssistantModal.tsx` | Modal chính (id `rag`, shortcut Alt+K). 2 tab: Search + Chat. Queue status indicator ở footer. |
| `SearchTab.tsx` | Semantic search UI: debounced input, filter chips (Notes/Tasks/Highlights), result list + empty/loading/error states. |
| `ResultCard.tsx` | 1 result row: icon + entity badge + title + snippet (highlight match) + similarity %. Click → navigate tới source. Task có badge status/priority/dueDate. |
| `ChatTab.tsx` | Hybrid RAG chat. 3 modes: Auto/Internal (vector retrieve) + Sách (book context, chỉ enable khi đang đọc PDF). Streaming với Stop button, markdown render khi xong. Citation `[n]` navigate tới source; `[p.X]` (Book mode) navigate tới `/reader/:id?page=X`. Badge "Từ ghi chú"/"Kết hợp"/"Kiến thức chung"/"Sách". |

## Mount point

Cả 2 manager mount trong `src/routes/Setting.tsx` qua pattern `ToolCategoryManager` / `ShortcutManager`:

```ts
if (setting.group === 'RAG' && setting.type === 'SettingInfor') setRagTokensOpen(true);
if (setting.group === 'RAG' && setting.type === 'Config')        setRagConfigOpen(true);
```

## TODO (next phase)

- (done) Phase 4 — Book context chat. Ephemeral approach: extract text trang hiện tại ± 10 từ `PdfReader` → prompt → cite `[p.X]`. Không persist embedding cho PDF.