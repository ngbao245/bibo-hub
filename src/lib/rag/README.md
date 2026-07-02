# `src/lib/rag/` — RAG core logic

Module RAG (Retrieval Augmented Generation) — semantic search + AI chat trên notes / tasks / highlights.

## Doc liên quan

- **[docs/rag-integration-plan.md](../../../docs/rag-integration-plan.md)** — spec đầy đủ, kiến trúc, phase plan.

## Convention

- Mọi function gọi Gemini API phải đi qua `gemini.ts` (không gọi trực tiếp `fetch` ra Google). Lý do: key pool rotation logic ở đó.
- Mọi query Supabase RAG phải đi qua `supabase-rag.ts`.
- Tokens KHÔNG bao giờ log ra console (kể cả debug).
- Filter `type='secret'` ở mọi nơi nhận note input — cứng, không dựa flag.

## File

| File | Mô tả |
|---|---|
| `types.ts` | `RagConfig`, `RagTokens`, `RagStatus`, errors, `DEFAULT_RAG_CONFIG`, `EMPTY_RAG_TOKENS` |
| `rag-config.ts` | Load + parse record `group=RAG, type=Config` từ MockAPI, fallback default |
| `rag-vault.ts` | Load + decrypt record `group=RAG, type=SettingInfor` (3 Gemini keys + Groq) |
| `auto-bootstrap.ts` | `tryBootstrapRag()` gọi 1 lần ở App boot, set Zustand `ragStore` |
| `key-pool.ts` | `GeminiKeyPool` class — rotate key, track rate limit, auto failover |
| `gemini.ts` | `embedText`, `embedQuery`, `embedTexts`, `chat`, `chatStream` qua pool + retry |
| `supabase-rag.ts` | `upsertEmbedding`, `upsertEmbeddingChunks`, `deleteEmbedding`, `listEntityHashes`, `matchEmbeddings` |
| `chunk.ts` | `stripHtml`, `chunkText` (recursive split), `hashContent`, `shouldEmbed` |
| `build-text.ts` | `buildNoteEmbedText`, `buildTaskEmbedText` (metadata-rich), `buildHighlightEmbedText` + metadata helpers |
| `embed-queue.ts` | Background queue + retry, `enqueueEmbed/Delete`, `subscribeQueue` |
| `dual-write.ts` | Helpers `dualWriteNote/Task/Highlight` cho `onSuccess` mutation, safe-fail |
| `backfill.ts` | `runBackfill(onProgress)` — diff source ↔ rag_embeddings, enqueue jobs |
| `search.ts` | `ragRetrieve(query, k)` — embed query, match top-K, dedupe theo entity (giữ chunk similarity cao nhất), trả về results + maxSimilarity + rawChunks |
| `intent.ts` | (Phase 2.5) Pre-computed `FILTER_VECTORS` + cosine-based intent detection |
| `prompts.ts` | (Phase 3) System prompts cho Auto mode (with/without context) + Internal mode + (Phase 4) `promptBookContext` cho mode Sách |
| `book-context.ts` | (Phase 4) `extractBookContext(doc, page, window)` — extract text plain trang [N-w, N+w] từ PDF, cache WeakMap theo doc. Ephemeral, không vector hóa |

## Settings storage

Module này đọc settings từ MockAPI table `/Config`, group `RAG`:

| Record type | Encrypted | Mô tả |
|---|---|---|
| `SettingInfor` | ✅ | 3 Gemini keys + 1 Groq key fallback |
| `Config` | ❌ | Nguồn dữ liệu, chat mode, threshold, idle delay, shortcut |

UI quản lý qua 2 custom managers:
- `src/components/rag/RagTokensManager.tsx`
- `src/components/rag/RagConfigManager.tsx`

Mount vào `src/routes/Setting.tsx` theo pattern `ToolCategoryManager` / `ShortcutManager`.