// ============================================================
// RAG config loader — đọc record `group=RAG, type=Config` từ
// MockAPI `/Config`. Plaintext, không encrypt.
//
// Lấy từng FieldEntry trong config1..config10, map về RagConfig.
// Field nào thiếu/sai format → dùng giá trị mặc định.
//
// Khi user chưa tạo record nào → trả về DEFAULT_RAG_CONFIG.
// ============================================================

import { fetchJson } from '@/api/client';
import { API } from '@/lib/config';
import { parseSettingList, CONFIG_KEYS } from '@/lib/setting';
import { decodeFieldSlots } from '@/lib/fieldSlots';
import type { NoteType } from '@/schemas/note';

import {
  DEFAULT_RAG_CONFIG,
  type EntityType,
  type RagChatMode,
  type RagConfig,
  type RagMinLengthFilter,
} from './types';

const VALID_ENTITY_TYPES: EntityType[] = ['note', 'task', 'highlight', 'book_chunk'];

const RAG_GROUP = 'RAG';
const CONFIG_TYPE = 'Config';

/**
 * NoteTypes hợp lệ cho enabledNoteTypes.
 *
 * Bao gồm mọi type trong app trừ `secret` (hard filter, luôn loại trừ).
 * User tự tick trong Config UI để chọn loại nào embed.
 */
const VALID_NOTE_TYPES: NoteType[] = [
  'note',
  'ielts',
  'course',
  'code',
  'source',
  'savings',
  'order',
];

/**
 * Load RAG config từ MockAPI.
 *
 * - Không throw error: nếu record không tồn tại / fetch fail → log warn, trả default.
 * - Lý do: RAG có thể chạy với config mặc định, không phải critical path.
 */
export async function loadRagConfig(): Promise<RagConfig> {
  let list;
  try {
    list = parseSettingList(await fetchJson<unknown>(API.CONFIGS));
  } catch {
    // Fetch fail → app vẫn hoạt động với default, không spam toast
    return { ...DEFAULT_RAG_CONFIG };
  }

  const record = list.find(
    (s) =>
      s.group.trim().toLowerCase() === RAG_GROUP.toLowerCase() &&
      s.type.trim().toLowerCase() === CONFIG_TYPE.toLowerCase(),
  );

  if (!record) return { ...DEFAULT_RAG_CONFIG };

  // Flatten tất cả fields từ config1..config10
  const entries = CONFIG_KEYS.flatMap((k) => decodeFieldSlots(record[k] ?? '', k));
  const get = (name: string): string | undefined => {
    const found = entries.find((e) => e.k.toLowerCase() === name.toLowerCase());
    return found?.v;
  };

  return {
    enabledNoteTypes: parseNoteTypesCsv(
      get('enabledNoteTypes'),
      DEFAULT_RAG_CONFIG.enabledNoteTypes,
    ),
    embedTasks: parseBool(get('embedTasks'), DEFAULT_RAG_CONFIG.embedTasks),
    embedHighlights: parseBool(get('embedHighlights'), DEFAULT_RAG_CONFIG.embedHighlights),
    embedBookChunks: parseBool(get('embedBookChunks'), DEFAULT_RAG_CONFIG.embedBookChunks),
    chatDefaultMode: parseChatMode(get('chatDefaultMode'), DEFAULT_RAG_CONFIG.chatDefaultMode),
    similarityThreshold: parseNumber(
      get('similarityThreshold'),
      DEFAULT_RAG_CONFIG.similarityThreshold,
      { min: 0, max: 1 },
    ),
    minLength: parseMinLength(
      get('minLengthEnabled'),
      get('minLengthChars'),
      get('minLengthApplyTo'),
    ),
  };
}

// ============================================================
// Parsers — defensive, mọi case sai format đều fallback default
// ============================================================

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

function parseNumber(
  raw: string | undefined,
  fallback: number,
  range: { min: number; max: number },
): number {
  if (raw === undefined) return fallback;
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return fallback;
  if (n < range.min || n > range.max) return fallback;
  return n;
}

function parseChatMode(raw: string | undefined, fallback: RagChatMode): RagChatMode {
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'auto' || v === 'internal') return v;
  return fallback;
}

function parseMinLength(
  enabledRaw: string | undefined,
  charsRaw: string | undefined,
  applyToRaw: string | undefined,
): RagMinLengthFilter {
  const fb = DEFAULT_RAG_CONFIG.minLength;
  return {
    enabled: parseBool(enabledRaw, fb.enabled),
    minChars: parseNumber(charsRaw, fb.minChars, { min: 0, max: 10_000 }),
    applyTo: parseEntityTypesCsv(applyToRaw, fb.applyTo),
  };
}

function parseEntityTypesCsv(
  raw: string | undefined,
  fallback: EntityType[],
): EntityType[] {
  if (raw === undefined) return [...fallback];
  const tokens = raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const filtered = tokens.filter((t): t is EntityType =>
    (VALID_ENTITY_TYPES as string[]).includes(t),
  );
  // Empty array valid: filter enabled nhưng không apply cho type nào = disable de-facto.
  return filtered;
}

function parseNoteTypesCsv(raw: string | undefined, fallback: NoteType[]): NoteType[] {
  if (!raw) return [...fallback];
  const tokens = raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const filtered = tokens.filter((t): t is NoteType =>
    (VALID_NOTE_TYPES as string[]).includes(t),
  );
  return filtered.length > 0 ? filtered : [...fallback];
}