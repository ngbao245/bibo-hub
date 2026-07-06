// ============================================================
// RAG types — interfaces dùng chung cho toàn module rag
// ============================================================
//
// Mọi config + token + result của RAG đều type tại đây.
// Khi đổi schema phải sync với:
//   - rag-config.ts (parse/serialize)
//   - rag-vault.ts (decrypt tokens)
//   - RagTokensManager.tsx + RagConfigManager.tsx (UI)
// ============================================================

import type { NoteType } from '@/schemas/note';

// ------------------------------------------------------------
// Entity types — cần khai báo trước vì Config reference tới
// ------------------------------------------------------------

/** Các loại entity được embed vào vector DB. */
export type EntityType = 'note' | 'task' | 'highlight' | 'book_chunk';

// ------------------------------------------------------------
// Configuration (non-sensitive, plaintext trong MockAPI /Config)
// ------------------------------------------------------------

/** Mode mặc định cho RAG chat panel. */
export type RagChatMode = 'auto' | 'internal';

/**
 * Filter độ dài content — skip embed nếu text quá ngắn.
 *
 * Áp dụng theo entity type: user có thể muốn skip note ngắn nhưng vẫn
 * embed task/highlight ngắn vì title/text đã đủ context.
 */
export interface RagMinLengthFilter {
  /** Tắt hoàn toàn filter → mọi content đều embed (kể cả rỗng). */
  enabled: boolean;
  /** Ngưỡng ký tự tối thiểu (sau stripHtml). */
  minChars: number;
  /** Chỉ áp dụng cho entity type nào. Vd ['note'] = chỉ filter note. */
  applyTo: EntityType[];
}

/** Config logic — quyết định source nào được embed, behavior chat. */
export interface RagConfig {
  /** Note types được index để vector search. Loại 'secret' luôn bị loại trừ. */
  enabledNoteTypes: NoteType[];

  /** Có index tasks (title + description + status/priority/dueDate) không. */
  embedTasks: boolean;

  /** Có index reader highlights không. */
  embedHighlights: boolean;

  /** Có index PDF full-text chunks (Phase 4) không. */
  embedBookChunks: boolean;

  /** Mode mặc định khi mở chat (user có thể override). */
  chatDefaultMode: RagChatMode;

  /** Threshold cho Auto mode: max similarity >= threshold thì cite notes. */
  similarityThreshold: number;

  /** Filter độ dài content — skip embed nếu quá ngắn. */
  minLength: RagMinLengthFilter;
}

/** Default config dùng khi chưa có record Config trong MockAPI. */
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

// ------------------------------------------------------------
// Tokens (sensitive, encrypted trong MockAPI /Config)
// ------------------------------------------------------------

/**
 * API tokens cho RAG.
 *
 * - `geminiApiKeys`: array dynamic, tối thiểu 1 key (validation UI).
 * - Mỗi key từ 1 Google account riêng → tăng quota N×1500 RPD.
 * - Storage: array được encode thành entries `{k:"geminiApiKey"+i, e, v}`
 *   trong `config1`, backward compat với format cũ (3 field cứng).
 */
export interface RagTokens {
  geminiApiKeys: string[];
}

/** Token rỗng (default khi user chưa setup). */
export const EMPTY_RAG_TOKENS: RagTokens = {
  geminiApiKeys: [],
};

/** Trả về array Gemini keys non-empty (cho key pool). */
export function activeGeminiKeys(tokens: RagTokens): string[] {
  return tokens.geminiApiKeys.map((k) => k.trim()).filter((k) => k.length > 0);
}

// ------------------------------------------------------------
// Status — derived state cho UI
// ------------------------------------------------------------

/** Bootstrap status của RAG module. */
export type RagStatus =
  | 'idle'           // chưa bootstrap
  | 'loading'        // đang load config + tokens
  | 'ready'          // có ít nhất 1 Gemini key + Supabase session
  | 'needs_setup'    // chưa có Gemini key → user mở Setting để setup
  | 'error';         // lỗi không recover được (vd invalid passphrase)

// ------------------------------------------------------------
// Errors
// ------------------------------------------------------------

export class RagNoTokenError extends Error {
  constructor() {
    super('No Gemini API key configured');
    this.name = 'RagNoTokenError';
  }
}

export class RagAllKeysFailedError extends Error {
  constructor(message: string = 'All Gemini keys exhausted or invalid') {
    super(message);
    this.name = 'RagAllKeysFailedError';
  }
}

export class RagQuotaExceededError extends Error {
  constructor(message: string = 'Rate limit exceeded across all keys') {
    super(message);
    this.name = 'RagQuotaExceededError';
  }
}

export class RagVaultError extends Error {
  code: 'fetch_failed' | 'no_record' | 'no_fields' | 'decrypt_failed' | 'empty_value';
  constructor(code: RagVaultError['code'], message: string) {
    super(message);
    this.name = 'RagVaultError';
    this.code = code;
  }
}

// ------------------------------------------------------------
// Search & embedding result types
// ------------------------------------------------------------

/** Một row trả về từ RPC `rag_match_embeddings`. */
export interface RagMatchRow {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  chunk_index: number;
  chunk_text: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

/** Kết quả search sau khi enrich từ TanStack cache. */
export interface RagSearchResult {
  /** entity_id từ MockAPI hoặc UUID highlight. */
  id: string;
  entityType: EntityType;
  title: string;
  /** Snippet text gốc (chunk_text từ Supabase). */
  snippet: string;
  similarity: number;
  /** Metadata raw từ rag_embeddings.metadata (tag, dueDate, page...). */
  metadata: Record<string, unknown>;
}