// ============================================================
// Session title + summary generation via Gemini
// ============================================================
//
// 2 hàm util cho feature RAG Chat Sessions:
//   - generateSessionTitle: 1 Gemini call, output max 50 char plaintext.
//   - generateSessionSummary: 1 Gemini call, tóm messages cũ cho prompt injection.
//
// Cả 2 non-blocking cho UX chính:
//   - Title fail → fallback truncate 50 char từ user msg đầu.
//   - Summary fail → fallback empty string (không inject gì).
// ============================================================

import { chat, type ChatMessage } from './gemini';
import type { StoredMessage } from './sessions';

const TITLE_MAX_LEN = 50;
const SUMMARY_MAX_MESSAGES = 40; // giới hạn input để tránh prompt quá lớn

// ------------------------------------------------------------
// Timeout helper
// ------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// ------------------------------------------------------------
// Fallback truncate
// ------------------------------------------------------------

function truncateAtWordBoundary(text: string, maxLen: number): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) return cut.slice(0, lastSpace) + '...';
  return cut + '...';
}

// ------------------------------------------------------------
// Title
// ------------------------------------------------------------

/**
 * Gen title session ngắn (tối đa 50 char) từ 1 cặp user + assistant.
 * Fallback truncate user msg nếu Gemini fail.
 */
export async function generateSessionTitle(
  userMsg: string,
  assistantMsg: string,
): Promise<string> {
  const fallback = truncateAtWordBoundary(userMsg, TITLE_MAX_LEN);

  try {
    const prompt = `Sinh title ngắn cho cuộc chat này bằng tiếng Việt (tối đa ${TITLE_MAX_LEN} ký tự). Chỉ trả về title thuần, không markdown, không dấu ngoặc, không giải thích.

User: ${userMsg.slice(0, 400)}
Assistant: ${assistantMsg.slice(0, 800)}`;

    const messages: ChatMessage[] = [{ role: 'user', text: prompt }];

    const raw = await withTimeout(
      chat(messages, { temperature: 0.3, maxTokens: 60 }),
      10_000,
    );

    const cleaned = raw
      .replace(/^["'`\s]+|["'`\s]+$/g, '')
      .replace(/[\r\n]+/g, ' ')
      .trim();

    if (!cleaned) return fallback;
    return cleaned.length > TITLE_MAX_LEN
      ? truncateAtWordBoundary(cleaned, TITLE_MAX_LEN)
      : cleaned;
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------
// Summary
// ------------------------------------------------------------

/**
 * Tóm messages cũ thành 200-400 từ để prepend vào system prompt của
 * message tiếp theo — user không thấy, chỉ Gemini thấy.
 *
 * Fail → return empty string (caller không inject gì).
 */
export async function generateSessionSummary(
  messages: StoredMessage[],
): Promise<string> {
  if (messages.length === 0) return '';

  const recent = messages.slice(-SUMMARY_MAX_MESSAGES);
  const transcript = recent
    .map((m) => `[${m.role === 'user' ? 'User' : 'Assistant'}] ${m.text}`)
    .join('\n\n');

  const prompt = `Tóm tắt cuộc chat sau thành 200-400 từ tiếng Việt. Giữ các concept quan trọng, tên riêng, số liệu, kết luận. Viết liền một khối, không bullet, không heading, không markdown. Không thêm lời dẫn "Đây là tóm tắt".

${transcript}`;

  try {
    const chatMessages: ChatMessage[] = [{ role: 'user', text: prompt }];
    const raw = await withTimeout(
      chat(chatMessages, { temperature: 0.3, maxTokens: 700 }),
      20_000,
    );
    return raw.trim();
  } catch {
    return '';
  }
}