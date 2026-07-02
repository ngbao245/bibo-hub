// ============================================================
// Search & retrieval — high-level RAG API cho UI
// ============================================================
//
// Flow:
//   query → embedQuery → matchEmbeddings → group by entity → enrich
//
// Group by entity_id: nhiều chunk cùng note → 1 result với chunk có
// similarity cao nhất làm snippet.
// ============================================================

import { embedQuery } from './gemini';
import { matchEmbeddings, type MatchOpts } from './supabase-rag';
import { detectFilters } from './intent';
import type {
  EntityType,
  RagMatchRow,
  RagSearchResult,
} from './types';

export interface RagRetrieveOpts {
  /** Số kết quả (entity unique) muốn trả về. Default 10. */
  limit?: number;
  /** Lọc theo entity type. Undefined = mọi type. */
  filterTypes?: EntityType[];
  /** Filter metadata jsonb @>. Vd `{status: 'pending'}`. */
  filterMetadata?: Record<string, unknown>;
  /** Min similarity (0..1). Default 0.5. */
  minSimilarity?: number;
}

export interface RagRetrieveResult {
  /** Kết quả đã enrich (1 row / entity), sort similarity desc. */
  results: RagSearchResult[];
  /** Max similarity trong tất cả chunks — dùng cho Auto mode decision. */
  maxSimilarity: number;
  /** Toàn bộ chunks raw cho prompt context (Phase 3 chat). */
  rawChunks: RagMatchRow[];
}

/**
 * Retrieve top-K relevant entities cho 1 query.
 *
 * Multi-chunk per entity: query embeddings table có thể trả về nhiều
 * chunk cùng entity. Group lại, giữ chunk có similarity cao nhất làm
 * snippet đại diện.
 *
 * Để có đủ entity unique sau dedup, query với `match_count * 2`.
 */
export async function ragRetrieve(
  query: string,
  opts: RagRetrieveOpts = {},
): Promise<RagRetrieveResult> {
  const limit = opts.limit ?? 10;

  const qVec = await embedQuery(query);

  // Phase 2.5: Intent detection — auto-detect structured filters
  let resolvedFilterTypes = opts.filterTypes;
  let resolvedFilterMetadata = opts.filterMetadata;

  if (!resolvedFilterMetadata) {
    try {
      const intent = await detectFilters(qVec);
      if (intent.filterMetadata) {
        resolvedFilterMetadata = intent.filterMetadata;
      }
      if (intent.suggestedType && !resolvedFilterTypes) {
        resolvedFilterTypes = [intent.suggestedType as EntityType];
      }
    } catch {
      // Intent fail → pure vector search, no filter
    }
  }

  const matchOpts: MatchOpts = {
    match_count: limit * 2, // dư để dedup chunks → entity
    filter_types: resolvedFilterTypes,
    filter_metadata: resolvedFilterMetadata,
    min_similarity: opts.minSimilarity ?? 0.5,
  };

  const rawChunks = await matchEmbeddings(qVec, matchOpts);

  // Group by entity (entity_type + entity_id), keep best chunk per entity
  const byEntity = new Map<string, RagMatchRow>();
  for (const row of rawChunks) {
    const key = `${row.entity_type}:${row.entity_id}`;
    const existing = byEntity.get(key);
    if (!existing || row.similarity > existing.similarity) {
      byEntity.set(key, row);
    }
  }

  // Sort desc by similarity
  const sorted = Array.from(byEntity.values()).sort(
    (a, b) => b.similarity - a.similarity,
  );

  // Trim to requested limit
  const trimmed = sorted.slice(0, limit);

  const results: RagSearchResult[] = trimmed.map((row) => ({
    id: row.entity_id,
    entityType: row.entity_type,
    title: extractTitle(row),
    snippet: row.chunk_text,
    similarity: row.similarity,
    metadata: row.metadata,
  }));

  const maxSimilarity = trimmed.length > 0 ? trimmed[0].similarity : 0;

  return { results, maxSimilarity, rawChunks };
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Extract title từ metadata theo entity_type.
 *
 * Note: metadata.title (saved tại build-text)
 * Task: metadata.title
 * Highlight: metadata.bookTitle + page
 * Book chunk: metadata.bookTitle + page (Phase 4)
 */
function extractTitle(row: RagMatchRow): string {
  const m = row.metadata ?? {};
  switch (row.entity_type) {
    case 'note': {
      const title = typeof m.title === 'string' ? m.title : '';
      return title || '(no title)';
    }
    case 'task': {
      const title = typeof m.title === 'string' ? m.title : '';
      return title || '(task)';
    }
    case 'highlight': {
      const book = typeof m.bookTitle === 'string' ? m.bookTitle : 'Book';
      const page = typeof m.page === 'number' ? `p.${m.page}` : '';
      return [book, page].filter(Boolean).join(' · ');
    }
    case 'book_chunk': {
      const book = typeof m.bookTitle === 'string' ? m.bookTitle : 'Book';
      const page = typeof m.page === 'number' ? `p.${m.page}` : '';
      return [book, page].filter(Boolean).join(' · ');
    }
    default:
      return '(unknown)';
  }
}