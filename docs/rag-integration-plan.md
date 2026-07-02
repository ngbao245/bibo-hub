# RAG Integration Plan — BiBo Tools v2

Tài liệu plan + trạng thái triển khai RAG (Retrieval Augmented Generation) trên kho note / task / highlight. Mục tiêu: zero-cost, chất lượng tốt nhất trên free tier.

**Trạng thái**: ✅ **Đã ship đến Phase 4**. Doc này reflect **thực tế code hiện tại**, không phải plan ban đầu.

---

## 1. Mục tiêu & phạm vi

### Mục tiêu

- **Semantic search**: hỏi bằng câu tự nhiên, trả về note / highlight liên quan, không phụ thuộc keyword match.
- **Hybrid RAG chat**: ask AI, tự động kết hợp kiến thức cá nhân (notes/highlights) + kiến thức chung của LLM.
- **Book context chat**: khi đang đọc PDF, hỏi nội dung sách quanh trang đang đọc (ephemeral, zero cost).
- **Zero-cost** cho scale cá nhân (~5k notes, ~1k highlights, vài cuốn PDF).
- **Không phá** data hiện tại ở MockAPI. Embeddings là layer phụ, wipe + rebuild bất kỳ lúc nào.

### Phạm vi

Source content RAG index:

| Source | Hiện ở | Trạng thái |
|---|---|---|
| Notes (type user tick trong config) | MockAPI | ✅ Phase 1 |
| Tasks (title + metadata-rich text) | MockAPI | ✅ Phase 1 |
| Reader highlights (text + note user) | Supabase | ✅ Phase 1 |
| PDF full-text (vector persist) | — | ❌ Bỏ, thay bằng ephemeral (Phase 4B) |

**Loại trừ cứng (không config được):**

- `type='secret'` — hard filter, luôn skip.
- Content rỗng / chỉ ký tự đặc biệt (không có chữ cái Unicode).

**Loại trừ mềm (user tick trong RagConfigManager):**

- Bỏ tick note type → skip embed cho type đó.
- Filter min-length: user bật + set ngưỡng + chọn apply cho entity type nào.

---

## 2. Kiến trúc

### Stack chốt (đã ship)

| Layer | Tech | Ghi chú |
|---|---|---|
| Embedding | Gemini `gemini-embedding-001` + `outputDimensionality: 768` | Ban đầu định dùng `text-embedding-004`, nhưng model đó không available cho free tier |
| Vector DB | Supabase pgvector (chung project với Reader) | Database 500MB tách khỏi Storage 1GB → không đụng quota lưu sách |
| LLM | Gemini `gemini-2.5-flash` (streaming SSE) | Free 1500 req/ngày/key |
| API key | MockAPI `/Config` (encrypted bằng APP_SECRET) | Reuse vault infra Reader |
| Fallback LLM | Groq (Llama 3.3 70B, 14,400 RPD) | Khi tất cả Gemini keys exhausted |
| Fallback embed | ❌ Không có (Xenova bỏ vì trọng lượng bundle) | Gemini free đủ dùng |

### Data flow (thực tế)

```
WRITE PATH (dual-write, background, sau mỗi mutation success):
  User Ctrl+S / trigger save note
    → useUpdateNote → MockAPI POST/PUT
    → onSuccess: dualWriteNote(note)
        → check type != 'secret'
        → check note.type ∈ config.enabledNoteTypes
        → shouldEmbedForType(text, 'note', config.minLength)
        → enqueueEmbed(job)  [queue in-memory, serial, 4.5s delay]
        → Gemini embed API → vector(768)
        → Supabase upsert vào rag_embeddings

READ PATH (semantic search):
  User gõ query trong SearchTab
    → debounce 300ms → embedQuery(text) → Gemini → vector(768)
    → detectFilters(queryVec) — Phase 2.5 intent detection
    → Supabase RPC rag_match_embeddings(query_vec, k=20, filter_types, filter_metadata, min_sim=0.5)
    → dedupe theo entity_id, giữ chunk có similarity cao nhất
    → render ResultCard với link tới source

RAG CHAT (Auto / Internal mode):
  User hỏi + chọn mode
    → retrieve: embed query → matchEmbeddings top-8 → maxSimilarity
    → quyết định systemPrompt:
        - mode == 'internal':               promptInternal(chunks)
        - mode == 'auto' && sim >= 0.6:     promptAutoWithContext(chunks)
        - mode == 'auto' && sim < 0.6:      PROMPT_AUTO_NO_CONTEXT (LLM thuần)
    → chatStream Gemini SSE → render markdown token-by-token
    → parse citation [n] → button click navigate tới source
    → filter sources chỉ giữ những [n] AI thực sự cite

BOOK MODE (đang đọc PDF):
  User hỏi câu về sách
    → skip vector retrieve
    → extractBookContext(doc, currentPage, window=10) — pdfjs getTextContent, cache WeakMap
    → promptBookContext(context, currentPage, from, to)
    → chatStream Gemini
    → citation [p.X] → navigate /reader/read/:bookId?page=X
```

### Tách biệt source of truth

- **MockAPI = source of truth** cho content (note/task).
- **Supabase highlights + rag_embeddings** — Supabase native cho Reader.
- **rag_embeddings = derived index** cho semantic search. Có thể wipe + backfill bất kỳ lúc nào.
- Sync qua `content_hash` (sha256 của text embed) — biết khi nào re-embed.

---

## 3. Settings storage (MockAPI `/Config`)

### Records hiện tại

Group `"RAG"` trong table `/Config`, có 2 records:

#### Record 1: `type="SettingInfor"` — sensitive tokens (encrypted)

Fields encrypted bằng `APP_SECRET`:

| Field | Required | Mô tả |
|---|---|---|
| `geminiApiKey1` | Bắt buộc ≥ 1 trong 3 | Gemini key #1 |
| `geminiApiKey2` | Optional | Gemini key #2 (Google account khác) |
| `geminiApiKey3` | Optional | Gemini key #3 (Google account khác) |
| `groqApiKey` | Optional | Fallback cuối khi Gemini exhausted |

#### Record 2: `type="Config"` — non-sensitive config (plaintext)

Fields (đã sync với `RagConfig` type):

| Field | Type | Default | Mô tả |
|---|---|---|---|
| `enabledNoteTypes` | CSV | `note,ielts,course,code` | Note types embed. `secret` luôn loại trừ |
| `embedTasks` | boolean | `false` | Index tasks |
| `embedHighlights` | boolean | `true` | Index reader highlights |
| `embedBookChunks` | boolean | `false` | Reserved (Phase 4 vector persist đã bỏ) |
| `chatDefaultMode` | enum | `auto` | `auto` hoặc `internal` |
| `similarityThreshold` | number | `0.6` | Threshold cho Auto mode |
| `minLengthEnabled` | boolean | `false` | Bật filter độ dài content |
| `minLengthChars` | number | `50` | Ngưỡng ký tự tối thiểu |
| `minLengthApplyTo` | CSV EntityType | `note` | Filter apply cho entity type nào |

### Default config

```ts
// src/lib/rag/types.ts — thực tế hiện tại
export const DEFAULT_RAG_CONFIG: RagConfig = {
  enabledNoteTypes: [],
  embedTasks: false,
  embedHighlights: false,
  embedBookChunks: false,
  chatDefaultMode: 'auto',
  similarityThreshold: 0.6,
  minLength: {
    enabled: false,
    minChars: 50,
    applyTo: [],
  },
};
```

### Fields đã bỏ so với plan ban đầu

| Field | Lý do bỏ |
|---|---|
| `embedIdleDelayMs` | Trigger 2 (idle 60s auto-embed) không implement — dùng lazy fixup thay thế |
| `modalShortcut` | Shortcut `Alt+K` hardcode trong `src/lib/tools.ts`, không cần config động |

### Custom managers (đã có)

Mount trong `src/routes/Setting.tsx`:

- `RagTokensManager.tsx` — 3 input Gemini + 1 Groq, test button per key, encrypt khi save.
- `RagConfigManager.tsx` — 4 sections: Nguồn dữ liệu / Chat / Filter độ dài / Backfill.

### Loading flow

```
App boot (App.tsx useEffect)
  → useBootstrapRag hook
  → tryBootstrapRag():
      1. loadRagConfig() → fetch /Config → parse hoặc fallback DEFAULT_RAG_CONFIG
      2. loadRagTokens() → decrypt bằng APP_SECRET
      3. Validate 1 embed call (cache 1h)
      4. Set Zustand ragStore
  → nếu ready → sau 5s chạy lazy fixup tầng 1 (background full scan)
```

---

## 4. Supabase schema

### Bảng `rag_embeddings`

Prefix `rag_` để phân biệt với bảng của Reader.

```sql
create extension if not exists vector;

create table public.rag_embeddings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  entity_type   text not null check (entity_type in ('note', 'task', 'highlight', 'book_chunk')),
  entity_id     text not null,
  chunk_index   int  not null default 0,
  content_hash  text not null,
  chunk_text    text not null,
  metadata      jsonb not null default '{}'::jsonb,
  embedding     vector(768) not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, entity_type, entity_id, chunk_index)
);

create index rag_embeddings_vec_idx
  on public.rag_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index rag_embeddings_user_type_idx on public.rag_embeddings (user_id, entity_type);
create index rag_embeddings_entity_idx    on public.rag_embeddings (entity_type, entity_id);
```

### Row Level Security

```sql
alter table public.rag_embeddings enable row level security;

create policy "user owns rag_embeddings"
  on public.rag_embeddings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### RPC search function

Đã thêm `filter_metadata` (Phase 2.5):

```sql
create or replace function rag_match_embeddings(
  query_embedding vector(768),
  match_count int default 10,
  filter_types text[] default null,
  filter_metadata jsonb default null,
  min_similarity float default 0.5
)
returns table (
  id uuid, entity_type text, entity_id text, chunk_index int,
  chunk_text text, metadata jsonb, similarity float
)
language sql stable
as $func$
  select
    e.id, e.entity_type, e.entity_id, e.chunk_index,
    e.chunk_text, e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.rag_embeddings e
  where e.user_id = auth.uid()
    and (filter_types is null or e.entity_type = any(filter_types))
    and (filter_metadata is null or e.metadata @> filter_metadata)
    and 1 - (e.embedding <=> query_embedding) >= min_similarity
  order by e.embedding <=> query_embedding
  limit match_count;
$func$;
```

**Lưu ý:**

- Dùng dollar-quote tag `$func$` thay `$$` để tránh markdown autofix xóa nhầm.
- RPC **không trả `embedding`** để tiết kiệm egress.
- SQL migration script ở `scripts/rag-migration.sql`.

---

## 5. Cấu trúc folder client (thực tế)

```
src/
├─ lib/
│  └─ rag/
│     ├─ README.md
│     ├─ gemini.ts           # ✅ REST wrapper, key-pool rotation, chatStream SSE
│     ├─ key-pool.ts         # ✅ GeminiKeyPool rotation + cooldown
│     ├─ supabase-rag.ts     # ✅ upsertEmbedding/Chunks, delete, matchEmbeddings, listEntityHashes
│     ├─ chunk.ts            # ✅ stripHtml, chunkText, hashContent, shouldEmbedForType
│     ├─ build-text.ts       # ✅ buildNote/Task/HighlightEmbedText + metadata helpers
│     ├─ embed-queue.ts      # ✅ In-memory queue, serial 1 concurrent, 4.5s delay, 5 retries
│     ├─ dual-write.ts       # ✅ Hook cho onSuccess mutation (Note/Task/Highlight)
│     ├─ backfill.ts         # ✅ runBackfill + runLazyFixupNotes (chung diff logic)
│     ├─ search.ts           # ✅ ragRetrieve với intent detection
│     ├─ intent.ts           # ✅ Pre-computed FILTER_VECTORS + cosine detection
│     ├─ prompts.ts          # ✅ promptAutoWithContext / Internal / AUTO_NO_CONTEXT / BookContext
│     ├─ book-context.ts     # ✅ extractBookContext (ephemeral, WeakMap cache)
│     ├─ rag-vault.ts        # ✅ Load + decrypt tokens từ SettingInfor
│     ├─ rag-config.ts       # ✅ Load + parse Config, fallback DEFAULT_RAG_CONFIG
│     ├─ auto-bootstrap.ts   # ✅ tryBootstrapRag()
│     └─ types.ts            # ✅ RagConfig, RagTokens, EntityType, errors...
├─ api/
│  └─ rag.ts                 # ✅ useRagSearch (TanStack Query hook, debounce 300ms)
├─ hooks/
│  └─ useBootstrapRag.ts     # ✅ Gọi bootstrap 1 lần + lazy fixup tầng 1 sau 5s
├─ stores/
│  ├─ ragStore.ts            # ✅ { config, tokens, status, chatMode, pendingPrompt }
│  └─ readerStore.ts         # ✅ Share PDF doc + currentPage cho Book mode ChatTab
├─ components/
│  ├─ rag/
│  │  ├─ README.md
│  │  ├─ RagAssistantModal.tsx  # ✅ Modal chính, Search+Chat tabs, help overlay, queue progress bar
│  │  ├─ SearchTab.tsx          # ✅
│  │  ├─ ChatTab.tsx            # ✅ 3 modes (Auto/Internal/Sách), consume pendingPrompt
│  │  ├─ ResultCard.tsx         # ✅
│  │  ├─ RagTokensManager.tsx   # ✅
│  │  ├─ RagConfigManager.tsx   # ✅
│  │  └─ BackfillButton.tsx     # ✅
│  └─ reader/
│     ├─ PdfReader.tsx          # ✅ MOD: register readerStore, handle initialPage, "Hỏi AI" action
│     └─ SelectionMenu.tsx      # ✅ MOD: nút "Hỏi AI" đẩy pendingPrompt vào ragStore
└─ routes/
   ├─ Setting.tsx              # ✅ MOD: mount 2 RAG managers
   └─ reader/Reader.tsx        # ✅ MOD: parse ?page=X → initialPage prop
```

---

## 6. Phases (đã ship)

### Phase 0 — Foundation ✅

- Supabase: vector extension + `rag_embeddings` + RLS + RPC.
- Bootstrap RAG (config + tokens + validation embed 1 call cached 1h).
- Custom Setting managers.
- Core libs: key-pool, gemini wrapper, supabase-rag, chunk.

### Phase 1 — Index notes + tasks + highlights ✅

- `embed-queue.ts`: serial queue, 4.5s delay, 5 retries exponential backoff.
- `build-text.ts`: task text redundant keywords ("chưa hoàn thành đang làm pending todo").
- Task metadata giàu structured fields để filter.
- Hook vào mọi mutation (Create/Update/Delete/Toggle).
- `BackfillButton` với progress bar.
- Task được re-embed khi bất kỳ field nào đổi (status/priority/dueDate).

### Phase 2 — Semantic search UI ✅

- `useRagSearch` (TanStack Query, debounce 300ms, cache 2 phút).
- `SearchTab` với filter chips (All/Notes/Tasks/Highlights).
- `ResultCard` render với icon + title + snippet + similarity %.
- Empty/Loading/Error/Ready states.

### Phase 2.5 — Structured query support ✅

- Đã mở rộng RPC nhận `filter_metadata`.
- Pre-computed `FILTER_VECTORS` cho status/priority (~3 filter vectors, cache IndexedDB).
- `detectFilters(queryVec)` cosine ≥ 0.7 → auto add filter.
- Safety net: không match nào ≥ 0.7 → pure vector search.

### Phase 3 — Hybrid RAG chat ✅

- 2 modes: Auto (default), Internal.
- Streaming SSE token-by-token.
- Citation `[n]` clickable, navigate đúng route theo `entityType` + `metadata.type`.
- Post-stream filter sources: chỉ giữ `[n]` AI thực sự cite (fix bug 15 nguồn rác).
- Badge "Từ ghi chú" / "Kết hợp" / "Kiến thức chung".
- Stop button (AbortController), Clear conversation.

### Phase 4 — Book context chat (ephemeral, thay approach A) ✅

**Đổi approach so với plan gốc**: dùng ephemeral thay vì vector persist.

**Lý do**: Gemini 2.5 Flash context 1M token dư sức cho 21 trang (~8k token). Use case thực tế là "đang đọc + hỏi đoạn này", không phải "hỏi sách bất kỳ khi không mở". Zero embed cost, zero DB space.

- `readerStore.ts`: share `{doc, bookId, bookTitle, currentPage, numPages}`.
- `book-context.ts`: `extractBookContext(doc, page, window=10)` với WeakMap cache.
- `promptBookContext`: system prompt yêu cầu cite `[p.X]`.
- ChatTab mode "Sách" (thứ 3): auto enable khi `hasReader`, skip vector retrieve.
- Selection "Hỏi AI" trong PDF: `SelectionMenu` → `ragStore.setPendingPrompt` → ChatTab tự consume + gửi.
- Citation `[p.X]` navigate `/reader/read/:bookId?page=X` (route thực).

**Out of scope (khác plan gốc):**

- Vector index toàn văn PDF (approach A).
- Reader sidebar tab "AI" với Index/Re-index button.
- `entity_type='book_chunk'` không được dùng, giữ trong schema cho tương lai.

---

## 7. Embed timing — thực tế đã ship

Plan ban đầu chốt Hybrid (Trigger 1 + Trigger 2 + Lazy fixup 2 tầng). Thực tế ship phiên bản đơn giản hơn:

| Cơ chế Plan | Trạng thái | Ghi chú |
|---|---|---|
| Trigger 1: blur/beforeunload | ❌ Không ship | Complexity cao (IndexedDB queue persist),Withue thấp |
    - Fail → return 'needs_setup'hip | NoteEditor không auto-save, thêm cái này sẽ đổi UX |
| Lazy fixup tầng 1 (boot) | ✅ | `useBootstrapRag` gọi `runLazyFixupNotes()` sau 5s delay |
| Lazy fixup tầng 2 (mở modal) | ✅ | `RagAssistantModal` scan 10 note gần nhất, cooldown 5 phút |
| Trigger 0 (onSuccess mutation) | ✅ | Ẩn trong `dualWriteNote` — user Ctrl+S → embed |

**Trigger duy nhất chạy khi save**:

```
useUpdateNote.onSuccess → dualWriteNote → enqueueEmbed → queue drain background
```

**Lazy fixup silent-fail**: nếu Supabase fail hoặc Gemini quota hết thì không toast, note sẽ tự sync lần mở modal / boot tiếp theo.

**Cooldown lazy fixup tầng 2**: 5 phút giữa 2 scan → tránh spam khi user mở/đóng modal liên tục.

---

## 8. Quyết định đã chốt (cập nhật thực tế)

1. **Supabase project** ✅ chung với Reader. Database 500MB tách khỏi Storage 1GB.

2. **Auth** ✅ auto bootstrap. `tryBootstrapSupabase()` (Reader) + `tryBootstrapRag()` chạy ở App mount.

3. **UI entry** ✅ single modal `rag` (id trong `MODAL_IDS`) với 2 tabs Search/Chat. Shortcut `Alt+K` (hardcode trong `src/lib/tools.ts`).

4. **Embed timing** ✅ Đơn giản: Trigger 0 (onSuccess) + Lazy fixup 2 tầng. Bỏ Trigger 1+2.

5. **RAG chat modes** ✅ 3 modes: Auto (default) / Internal / Sách. Sách auto-enable khi đang đọc PDF.

6. **Similarity threshold** ✅ Default 0.6, user chỉnh được qua slider trong RagConfigManager (0.4 → 0.8).

7. **Lọc content rác** ✅ 2 tầng:
   - Hard filter: rỗng / không có chữ cái Unicode → luôn skip.
   - Soft filter (config): `minLength` với `enabled` / `minChars` / `applyTo[]`. Default OFF.

8. **Settings storage** ✅ 2 records MockAPI `/Config` group=RAG (SettingInfor + Config). Encrypt bằng `APP_SECRET`.

9. **Structured query support** ✅ Phase 2.5 (metadata-rich text + FILTER_VECTORS cosine). Phase 3+ LLM intent extraction chưa cần.

10. **Key pool rotation** ✅ 1-3 Gemini keys + 1 Groq fallback. Rotate theo RPM count thấp nhất. Cooldown 429, disable 401/403.

11. **Model chọn** ✅ `gemini-embedding-001` (768-dim ép qua `outputDimensionality`) + `gemini-2.5-flash` chat.

12. **Filter độ dài động** ✅ Phase mới thêm — user tick "Bật filter", chỉnh ngưỡng 10-500 ký tự, chọn apply cho `note` / `task` / `highlight`.

---

## 9. Verification checklist

- [x] `npm run build` pass, zero TS error.
- [x] `getDiagnostics` clean trên files RAG.
- [x] Backfill 100+ notes → Supabase table có row đúng.
- [x] Search semantic trả kết quả đúng intent.
- [x] Chat 3 mode hoạt động (Auto/Internal/Sách).
- [x] Citation click navigate đúng route (`/notes?noteId=X`, `/sources?noteId=X`, `/tasks?taskId=X&listId=Y`, `/reader/read/:bookId?page=X`).
- [x] Tắt mạng → queue retry khi reconnect.
- [x] Xóa note → embedding row biến mất.
- [x] Secret notes không có row.
- [ ] DB size monitoring UI (chưa có, cảnh báo 80% pending).

---

## 10. Out of scope (chưa ship, có thể sau)

- **Vector persist PDF** — approach A đã bỏ, chỉ cần khi user muốn search cross-book không mở sách.
- **LLM intent extraction (Phase 3+)** — Phase 2.5 đủ tốt cho hầu hết case.
- **Bypass RAG cho pure task query** — TanStack cache đọc thẳng, chưa implement.
- **Multi-user / sharing** — single-user only.
- **Reranking cross-encoder** — không cần với pgvector.
- **Hybrid search (BM25 + vector)** — nâng cấp nếu chất lượng kém.
- **DB size warning 80%** — chưa có UI monitor.
- **Garbage collect auto** — `runBackfill` có GC nhưng phải bấm nút.
- **Mobile-specific optimization** — UI responsive đủ.

---

## 11. Bugs đã fix trong quá trình ship

Xem `docs/rag-issues-log.md` cho danh sách đầy đủ. Highlights:

1. Model `text-embedding-004` không available → đổi sang `gemini-embedding-001`.
2. Dimension mismatch 3072 vs 768 → thêm `outputDimensionality: 768`.
3. Tasks không embed → bug config chưa reload store sau save.
4. Rate limit 429 → giảm concurrency về 1, delay 4.5s, retry 5 lần exponential.
5. Chat trả lời generic thay vì cite → tasks chưa embed (fix ở bug 3+4).
6. Source list hiện 15 nguồn rác → filter chỉ giữ `[n]` AI cite.
7. Citation `[p.X]` không nhảy → route đúng là `/reader/read/:id` không phải `/reader/:id`.
8. `embedIdleDelayMs` + `modalShortcut` dead code → xóa khỏi types + UI + parser.

---

## 12. References

**Internal:**

- [`docs/database.md`](./database.md) — schema MockAPI.
- [`docs/reader.md`](./reader.md) — Reader architecture, pdfjs.
- [`docs/optimistic-ui.md`](./optimistic-ui.md) — pattern dual-write.
- [`docs/modal-system.md`](./modal-system.md) — pattern modal + shortcut.
- [`docs/rag-issues-log.md`](./rag-issues-log.md) — issues log chi tiết.
- [`scripts/rag-migration.sql`](../scripts/rag-migration.sql) — SQL migration.

**External:**

- [Google CodeLab "Build Second Brain"](https://colab.research.google.com/drive/18MNxjx4yveJsNSC6eT9rm2rf88f4d1B0) — reference pattern (Python stack, không copy code, học concept chunking + clean_text + metadata).
