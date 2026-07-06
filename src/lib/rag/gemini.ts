// ============================================================
// Gemini wrapper — embed + chat với key pool rotation
// ============================================================
//
// Mọi call ra Gemini API đi qua đây. Lý do:
//   - Quản lý key pool tập trung (rotate, cooldown, invalid)
//   - Không log token ra console
//
// Không lưu instance Gemini SDK — gọi REST trực tiếp.
// SDK `@google/generative-ai` không cần thiết, +200KB bundle vô ích.
// ============================================================

import { useRagStore } from '@/stores/ragStore';
import { activeGeminiKeys, RagAllKeysFailedError, RagNoTokenError } from './types';
import { GeminiKeyPool, type KeyState } from './key-pool';

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIM = 768;
const CHAT_MODEL = 'gemini-2.5-flash';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const MAX_RETRY = 3;

// ------------------------------------------------------------
// Pool singleton — sync với ragStore.tokens
// ------------------------------------------------------------

let pool: GeminiKeyPool = new GeminiKeyPool([]);

/** Cập nhật pool khi tokens trong store thay đổi. */
function syncPoolWithStore(): void {
  const keys = activeGeminiKeys(useRagStore.getState().tokens);
  pool.replaceKeys(keys);
}

// Subscribe 1 lần khi module load
useRagStore.subscribe((state, prev) => {
  if (state.tokens !== prev.tokens) syncPoolWithStore();
});
// Init lần đầu
syncPoolWithStore();

/** Export pool cho UI hiển thị status (RagTokensManager). */
export function getKeyPoolSnapshot() {
  return pool.snapshot();
}

/** Thông tin đợi khi tất cả key exhausted — cho friendly error message. */
export function getKeyPoolWaitInfo() {
  return pool.computeWaitInfo();
}

// ------------------------------------------------------------
// Retry orchestrator
// ------------------------------------------------------------

/**
 * Thử call Gemini API tối đa MAX_RETRY lần, mỗi lần pick key khác.
 *
 * - 429 RPM → markRateLimited(key, retry-after) → retry với key khác
 * - 429 RPD → markDailyExhausted(key) → retry với key khác
 * - 401/403 → markInvalid(key) → retry với key khác
 * - 500/503 → retry không markKey
 * - Mọi key fail → throw RagAllKeysFailedError → caller hiển thị friendly message
 */
async function callGeminiWithRetry<T>(
  fn: (key: KeyState) => Promise<T>,
): Promise<T> {
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    let state: KeyState;
    try {
      state = pool.pickKey();
    } catch (err) {
      // Hết key → throw ra, caller hiển thị friendly message
      throw err;
    }

    try {
      const result = await fn(state);
      pool.markSuccess(state.key);
      return result;
    } catch (err) {
      lastErr = err;

      // User aborted (Stop button) — không retry, throw ngay
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }

      const status = (err as GeminiError).status;
      const retryAfter = (err as GeminiError).retryAfterSec;

      if (status === 429) {
        // Phân biệt RPM vs RPD: check thông điệp / retryAfter
        const isDaily = retryAfter !== undefined && retryAfter > 3600;
        if (isDaily) pool.markDailyExhausted(state.key);
        else pool.markRateLimited(state.key, retryAfter);
        continue;
      }
      if (status === 401 || status === 403) {
        pool.markInvalid(state.key, `HTTP ${status}`);
        continue;
      }
      if (status && status >= 500 && status < 600) {
        // Server error tạm — không penalize key, đợi nhẹ rồi retry
        await sleep(500 * (attempt + 1));
        continue;
      }
      // Lỗi khác (network, parse...) → retry với key khác nhưng không markKey
      continue;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new RagAllKeysFailedError('All Gemini retries failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ------------------------------------------------------------
// HTTP error
// ------------------------------------------------------------

class GeminiError extends Error {
  status: number;
  retryAfterSec?: number;
  body?: unknown;
  constructor(status: number, message: string, body?: unknown, retryAfterSec?: number) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.retryAfterSec = retryAfterSec;
    this.body = body;
  }
}

async function geminiFetch(
  pathWithKey: (key: string) => string,
  key: string,
  body: unknown,
): Promise<unknown> {
  const path = pathWithKey(key);
  // Log endpoint (không log key) để user thấy mỗi lần tốn quota.
  const endpoint = path.split('?')[0];
  // eslint-disable-next-line no-console
  console.log(`[Gemini] ${endpoint}`);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let json: unknown = null;
    try { json = await res.json(); } catch { /* ignore */ }
    const retryHeader = res.headers.get('retry-after');
    const retryAfterSec = retryHeader ? Number(retryHeader) : undefined;
    throw new GeminiError(
      res.status,
      `Gemini ${res.status}: ${res.statusText}`,
      json,
      Number.isFinite(retryAfterSec) ? retryAfterSec : undefined,
    );
  }

  return res.json();
}

// ------------------------------------------------------------
// Embed
// ------------------------------------------------------------

/**
 * Embed 1 đoạn text → vector 768.
 *
 * Throw RagNoTokenError nếu không có Gemini key.
 * Throw RagAllKeysFailedError nếu tất cả key fail.
 */
export async function embedText(text: string): Promise<number[]> {
  if (pool.size() === 0) throw new RagNoTokenError();

  return callGeminiWithRetry(async (state) => {
    const json = (await geminiFetch(
      (k) => `/models/${EMBED_MODEL}:embedContent?key=${encodeURIComponent(k)}`,
      state.key,
      {
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIM,
      },
    )) as { embedding?: { values?: number[] } };

    const values = json.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('Gemini embedding response missing values');
    }
    return values;
  });
}

/**
 * Embed query — dùng cùng model. (embedding-001 không phân biệt
 * document vs query, nhưng giữ hàm riêng cho tương lai upgrade model.)
 */
export async function embedQuery(text: string): Promise<number[]> {
  return embedText(text);
}

/**
 * Batch embed nhiều text — gọi serial qua pool để fairness rotation.
 *
 * Lý do không parallel: Gemini batchEmbedContents endpoint tồn tại nhưng
 * đếm chung quota per request, rotation kém hiệu quả. Serial + pool rotate
 * giúp spread RPM ra nhiều key.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    out.push(await embedText(t));
  }
  return out;
}

// ------------------------------------------------------------
// Chat (streaming + non-streaming)
// ------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatOpts {
  systemPrompt?: string;
  temperature?: number;
  /** Max output tokens. Default 2048. */
  maxTokens?: number;
  /** Abort fetch khi user click Stop. */
  signal?: AbortSignal;
}

/** Gọi chat non-streaming, trả về full text. */
export async function chat(messages: ChatMessage[], opts: ChatOpts = {}): Promise<string> {
  if (pool.size() === 0) throw new RagNoTokenError();

  return callGeminiWithRetry(async (state) => {
    const json = (await geminiFetch(
      (k) => `/models/${CHAT_MODEL}:generateContent?key=${encodeURIComponent(k)}`,
      state.key,
      buildChatBody(messages, opts),
    )) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('') ?? '';
    return text;
  });
}

/**
 * Stream chat — gọi callback `onChunk(deltaText)` mỗi lần có token mới.
 *
 * Trả về full text khi xong.
 *
 * Lý do dùng SSE endpoint của Gemini: latency thấp, render token-by-token
 * trong UI.
 */
export async function chatStream(
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  opts: ChatOpts = {},
): Promise<string> {
  if (pool.size() === 0) throw new RagNoTokenError();

  return callGeminiWithRetry(async (state) => {
    // eslint-disable-next-line no-console
    console.log(`[Gemini] /models/${CHAT_MODEL}:streamGenerateContent`);
    const res = await fetch(
      `${API_BASE}/models/${CHAT_MODEL}:streamGenerateContent?alt=sse&key=${encodeURIComponent(state.key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildChatBody(messages, opts)),
        signal: opts.signal,
      },
    );

    if (!res.ok) {
      let json: unknown = null;
      try { json = await res.json(); } catch { /* ignore */ }
      const retryHeader = res.headers.get('retry-after');
      const retryAfterSec = retryHeader ? Number(retryHeader) : undefined;
      throw new GeminiError(
        res.status,
        `Gemini stream ${res.status}: ${res.statusText}`,
        json,
        Number.isFinite(retryAfterSec) ? retryAfterSec : undefined,
      );
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body for stream');

    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const delta = json.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? '')
            .join('') ?? '';
          if (delta) {
            full += delta;
            onChunk(delta);
          }
        } catch {
          // Bỏ qua payload không parse được
        }
      }
    }

    return full;
  });
}

function buildChatBody(messages: ChatMessage[], opts: ChatOpts) {
  return {
    systemInstruction: opts.systemPrompt
      ? { parts: [{ text: opts.systemPrompt }] }
      : undefined,
    contents: messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 2048,
    },
  };
}