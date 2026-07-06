// ============================================================
// RAG session types + parse/serialize helpers
// ============================================================
//
// MockAPI table /RagSession lưu 1 record per session. Field `messages`
// là JSON stringified array (MockAPI free tier không có Array/nested).
// Module này handle chuyển đổi raw ↔ parsed.
// ============================================================

import type { EntityType } from './types';

export type ChatModeStored = 'auto' | 'internal' | 'book';

/** Badge type — copy từ ChatTab để tránh cyclic import. */
export type BadgeStored = 'internal' | 'auto_context' | 'auto_pure' | 'book';

// ------------------------------------------------------------
// Constants — summary + lazy loading strategy
// ------------------------------------------------------------

/** Số message gửi raw cho Gemini (không qua summary). */
export const MSG_RAW_LIMIT = 10;
/** totalMessages > threshold thì bắt đầu dùng summary. */
export const SUMMARY_THRESHOLD = 10;
/** uncovered messages >= threshold thì regen summary background. */
export const REGEN_THRESHOLD = 10;
/** scrollTop dưới ngưỡng này thì trigger lazy load. */
export const SCROLL_TOP_TRIGGER_PX = 100;

/** Session summary — parsed từ field `summary` MockAPI. */
export interface SessionSummary {
  text: string;
  /** Index (0-based) của message cuối cùng đã được summarize. */
  upToIndex: number;
}

export interface StoredSource {
  index: number;
  entityType: EntityType;
  entityId: string;
  title: string;
  metadata: Record<string, unknown>;
}

export interface StoredBookScope {
  bookId: string;
  bookTitle: string;
  currentPage: number;
  fromPage: number;
  toPage: number;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources: StoredSource[];
  badge: BadgeStored | null;
  bookScope: StoredBookScope | null;
  ts: string; // ISO 8601
}

/** Session đã parse messages sang array. */
export interface RagSession {
  id: string;
  createdAt: string;
  title: string;
  messages: StoredMessage[];
  chatMode: ChatModeStored;
  bookId: string;
  bookTitle: string;
  updatedAt: string;
  messageCount: number;
  pinned: boolean;
  /** Tóm tắt các message cũ (để tối ưu token Gemini). null = chưa có. */
  summary: SessionSummary | null;
}

/** Session raw shape từ MockAPI (messages là string chưa parse). */
export interface RagSessionRaw {
  id: string;
  createdAt: string | number;
  title: string;
  messages: string;
  chatMode: string;
  bookId: string;
  bookTitle: string;
  updatedAt: string;
  messageCount: number;
  pinned: boolean;
  /** JSON stringified SessionSummary, hoặc "" nếu chưa có. */
  summary: string;
}

// ------------------------------------------------------------
// Parse / serialize
// ------------------------------------------------------------

const VALID_MODES: ChatModeStored[] = ['auto', 'internal', 'book'];

function normalizeChatMode(mode: string): ChatModeStored {
  return (VALID_MODES as string[]).includes(mode)
    ? (mode as ChatModeStored)
    : 'auto';
}

function parseMessages(raw: string): StoredMessage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is StoredMessage => {
        if (!m || typeof m !== 'object') return false;
        return (
          typeof (m as StoredMessage).id === 'string' &&
          ((m as StoredMessage).role === 'user' || (m as StoredMessage).role === 'model') &&
          typeof (m as StoredMessage).text === 'string'
        );
      })
      .map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        sources: Array.isArray(m.sources) ? m.sources : [],
        badge: m.badge ?? null,
        bookScope: m.bookScope ?? null,
        ts: typeof m.ts === 'string' ? m.ts : new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function parseSummaryField(raw: string): SessionSummary | null {
  if (!raw || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.text === 'string' &&
      typeof parsed.upToIndex === 'number' &&
      parsed.upToIndex >= 0
    ) {
      return { text: parsed.text, upToIndex: parsed.upToIndex };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function serializeSummary(s: SessionSummary | null): string {
  if (!s) return '';
  return JSON.stringify(s);
}

/** Parse raw MockAPI record → RagSession với messages array. */
export function parseRawSession(raw: RagSessionRaw): RagSession {
  const createdAt =
    typeof raw.createdAt === 'number'
      ? new Date(raw.createdAt * 1000).toISOString()
      : raw.createdAt || new Date().toISOString();

  return {
    id: raw.id,
    createdAt,
    title: raw.title || '',
    messages: parseMessages(raw.messages),
    chatMode: normalizeChatMode(raw.chatMode),
    bookId: raw.bookId || '',
    bookTitle: raw.bookTitle || '',
    updatedAt: raw.updatedAt || createdAt,
    messageCount: typeof raw.messageCount === 'number' ? raw.messageCount : 0,
    pinned: Boolean(raw.pinned),
    summary: parseSummaryField(raw.summary || ''),
  };
}

/** Serialize session → body cho POST/PUT MockAPI (trừ id + createdAt). */
export interface RagSessionWriteBody {
  title: string;
  messages: string;
  chatMode: string;
  bookId: string;
  bookTitle: string;
  updatedAt: string;
  messageCount: number;
  pinned: boolean;
  summary: string;
}

export function serializeSession(
  s: Omit<RagSession, 'id' | 'createdAt'>,
): RagSessionWriteBody {
  return {
    title: s.title,
    messages: JSON.stringify(s.messages),
    chatMode: s.chatMode,
    bookId: s.bookId,
    bookTitle: s.bookTitle,
    updatedAt: s.updatedAt,
    messageCount: s.messageCount,
    pinned: s.pinned,
    summary: serializeSummary(s.summary),
  };
}

/**
 * Sort sessions: pinned trước (theo updatedAt desc) → non-pinned (theo updatedAt desc).
 */
export function sortSessions(sessions: RagSession[]): RagSession[] {
  return [...sessions].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}