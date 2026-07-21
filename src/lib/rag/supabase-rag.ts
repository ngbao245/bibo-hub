// ============================================================
// Supabase RAG client — upsert / delete / query embeddings
// ============================================================
//
// Dùng chung Supabase client với Library (src/lib/library/supabase.ts).
// Table: `rag_embeddings`. RPC search: `rag_match_embeddings`.
//
// RLS đã filter theo auth.uid() → mọi query chỉ thấy row của user
// hiện tại. user_id phải lấy từ session khi upsert.
// ============================================================

import { supabase } from '@/tools/library/lib/supabase';
import type { EntityType, RagMatchRow } from './types';

// ------------------------------------------------------------
// Auth helper
// ------------------------------------------------------------

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('RAG: Supabase user not authenticated');
  }
  return data.user.id;
}

// ------------------------------------------------------------
// Upsert
// ------------------------------------------------------------

export interface UpsertEmbeddingInput {
  entity_type: EntityType;
  entity_id: string;
  chunk_index?: number;
  chunk_text: string;
  content_hash: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Upsert 1 embedding row.
 *
 * Conflict key: (user_id, entity_type, entity_id, chunk_index)
 * → re-embed cùng entity sẽ replace row cũ.
 */
export async function upsertEmbedding(input: UpsertEmbeddingInput): Promise<void> {
  const user_id = await requireUserId();
  const row = {
    user_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    chunk_index: input.chunk_index ?? 0,
    chunk_text: input.chunk_text,
    content_hash: input.content_hash,
    embedding: input.embedding,
    metadata: input.metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('rag_embeddings')
    .upsert(row, { onConflict: 'user_id,entity_type,entity_id,chunk_index' });

  if (error) throw new Error(`Upsert embedding failed: ${error.message}`);
}

/**
 * Upsert nhiều chunk của cùng 1 entity (note dài chia nhiều chunk).
 *
 * Sau khi upsert chunk mới, xóa các chunk_index cũ vượt số chunk hiện tại
 * (case note bị thu ngắn).
 */
export async function upsertEmbeddingChunks(
  base: Omit<UpsertEmbeddingInput, 'chunk_index' | 'chunk_text' | 'embedding'>,
  chunks: Array<{ chunk_text: string; embedding: number[] }>,
): Promise<void> {
  const user_id = await requireUserId();

  if (chunks.length === 0) {
    // Không có chunk → xóa hết embedding cho entity này
    await deleteEmbedding(base.entity_type, base.entity_id);
    return;
  }

  const now = new Date().toISOString();
  const rows = chunks.map((c, i) => ({
    user_id,
    entity_type: base.entity_type,
    entity_id: base.entity_id,
    chunk_index: i,
    chunk_text: c.chunk_text,
    content_hash: base.content_hash,
    embedding: c.embedding,
    metadata: base.metadata ?? {},
    updated_at: now,
  }));

  const { error: upsertErr } = await supabase
    .from('rag_embeddings')
    .upsert(rows, { onConflict: 'user_id,entity_type,entity_id,chunk_index' });
  if (upsertErr) throw new Error(`Upsert chunks failed: ${upsertErr.message}`);

  // Xóa chunk thừa (vd note trước có 5 chunk, giờ còn 3)
  const { error: delErr } = await supabase
    .from('rag_embeddings')
    .delete()
    .eq('user_id', user_id)
    .eq('entity_type', base.entity_type)
    .eq('entity_id', base.entity_id)
    .gte('chunk_index', chunks.length);
  if (delErr) throw new Error(`Cleanup stale chunks failed: ${delErr.message}`);
}

// ------------------------------------------------------------
// Delete
// ------------------------------------------------------------

/** Xóa toàn bộ chunks của 1 entity. */
export async function deleteEmbedding(
  entity_type: EntityType,
  entity_id: string,
): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await supabase
    .from('rag_embeddings')
    .delete()
    .eq('user_id', user_id)
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id);
  if (error) throw new Error(`Delete embedding failed: ${error.message}`);
}

/** Xóa nhiều entity cùng lúc (vd backfill garbage collect). */
export async function deleteEmbeddingsByEntityIds(
  entity_type: EntityType,
  entity_ids: string[],
): Promise<void> {
  if (entity_ids.length === 0) return;
  const user_id = await requireUserId();
  const { error } = await supabase
    .from('rag_embeddings')
    .delete()
    .eq('user_id', user_id)
    .eq('entity_type', entity_type)
    .in('entity_id', entity_ids);
  if (error) throw new Error(`Bulk delete failed: ${error.message}`);
}

// ------------------------------------------------------------
// Lookup
// ------------------------------------------------------------

/**
 * Trả về Map<entity_id, content_hash> cho 1 entity_type.
 * Dùng cho backfill: so sánh với MockAPI data → biết note nào cần re-embed.
 */
export async function listEntityHashes(
  entity_type: EntityType,
): Promise<Map<string, string>> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from('rag_embeddings')
    .select('entity_id, content_hash')
    .eq('user_id', user_id)
    .eq('entity_type', entity_type)
    .eq('chunk_index', 0); // 1 row per entity là đủ để biết hash

  if (error) throw new Error(`List hashes failed: ${error.message}`);

  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ entity_id: string; content_hash: string }>) {
    map.set(row.entity_id, row.content_hash);
  }
  return map;
}

// ------------------------------------------------------------
// Match (semantic search via RPC)
// ------------------------------------------------------------

export interface MatchOpts {
  /** Số kết quả trả về. Default 10. */
  match_count?: number;
  /** Lọc theo entity_type. Default null (mọi type). */
  filter_types?: EntityType[];
  /** Lọc theo metadata (jsonb @> filter). Default null. */
  filter_metadata?: Record<string, unknown>;
  /** Similarity tối thiểu (0..1). Default 0.5. */
  min_similarity?: number;
}

/**
 * Gọi RPC `rag_match_embeddings`.
 *
 * RPC không trả `embedding` cột → tiết kiệm egress.
 */
export async function matchEmbeddings(
  query_embedding: number[],
  opts: MatchOpts = {},
): Promise<RagMatchRow[]> {
  const { data, error } = await supabase.rpc('rag_match_embeddings', {
    query_embedding,
    match_count: opts.match_count ?? 10,
    filter_types: opts.filter_types ?? null,
    filter_metadata: opts.filter_metadata ?? null,
    min_similarity: opts.min_similarity ?? 0.5,
  });

  if (error) throw new Error(`Match embeddings failed: ${error.message}`);
  return (data ?? []) as RagMatchRow[];
}