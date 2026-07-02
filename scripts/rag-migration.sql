-- ============================================================
-- RAG schema migration — Supabase pgvector
-- ============================================================
--
-- Chạy 1 lần trên Supabase project (chung project Reader).
-- Output:
--   - extension `vector` (nếu chưa bật)
--   - bảng `rag_embeddings` + indexes
--   - RLS policy: user chỉ thấy row của chính mình
--   - RPC `rag_match_embeddings` (cosine similarity search)
--
-- Reference: docs/rag-integration-plan.md §4
-- ============================================================

create extension if not exists vector;

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------

create table if not exists public.rag_embeddings (
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

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

-- HNSW index cho cosine similarity (pgvector >= 0.5.0)
create index if not exists rag_embeddings_vec_idx
  on public.rag_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists rag_embeddings_user_type_idx
  on public.rag_embeddings (user_id, entity_type);

create index if not exists rag_embeddings_entity_idx
  on public.rag_embeddings (entity_type, entity_id);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------

alter table public.rag_embeddings enable row level security;

drop policy if exists "user owns rag_embeddings" on public.rag_embeddings;
create policy "user owns rag_embeddings"
  on public.rag_embeddings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- RPC search
-- ------------------------------------------------------------
--
-- Dùng dollar-quote tag $func$ thay vì $$ để tránh markdown autofix
-- lỡ tay xóa mất ký tự khi paste qua doc.

create or replace function rag_match_embeddings(
  query_embedding vector(768),
  match_count int default 10,
  filter_types text[] default null,
  filter_metadata jsonb default null,
  min_similarity float default 0.5
)
returns table (
  id            uuid,
  entity_type   text,
  entity_id     text,
  chunk_index   int,
  chunk_text    text,
  metadata      jsonb,
  similarity    float
)
language sql stable
as $func$
  select
    e.id,
    e.entity_type,
    e.entity_id,
    e.chunk_index,
    e.chunk_text,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.rag_embeddings e
  where e.user_id = auth.uid()
    and (filter_types is null or e.entity_type = any(filter_types))
    and (filter_metadata is null or e.metadata @> filter_metadata)
    and 1 - (e.embedding <=> query_embedding) >= min_similarity
  order by e.embedding <=> query_embedding
  limit match_count;
$func$;
