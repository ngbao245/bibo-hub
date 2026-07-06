import { toast } from 'sonner';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { json as jsonLang } from '@codemirror/lang-json';
import { buildExtensions, getLanguageExtension } from './codemirror-setup';
import type { SourceFormat } from './types';

// ============================================================
// Workspace utils — shared helpers cho 6 feature workspace mới
// ============================================================

/** Copy text vào clipboard + toast confirm. */
export async function copyToClipboard(text: string, label = 'Copied'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Không copy được — clipboard permission?');
  }
}

/**
 * Deep sort keys của object recursive.
 * Direction: 'asc' | 'desc'. Array giữ nguyên order (chỉ sort keys của
 * object bên trong).
 */
export function deepSortKeys<T>(value: T, direction: 'asc' | 'desc' = 'asc'): T {
  if (Array.isArray(value)) {
    return value.map((v) => deepSortKeys(v, direction)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    entries.sort(([a], [b]) => (direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a)));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      out[k] = deepSortKeys(v, direction);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Tạo readonly EditorView với text + language. Trả về view để caller mount
 * vào ref div.
 */
export function createReadonlyEditor(
  parent: HTMLElement,
  initialText: string,
  format: SourceFormat = 'json'
): EditorView {
  const state = EditorState.create({
    doc: initialText,
    extensions: [
      ...buildExtensions(format, () => {
        // no-op — readonly, không cần listener
      }),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
    ],
  });
  return new EditorView({ state, parent });
}

/** JSON language cherry-pick khi cần render nhanh 1 CodeMirror không cần full extensions bundle. */
export function jsonLanguageExtension() {
  return jsonLang();
}

// ============================================================
// JSONL helpers — smart auto-detect
// ============================================================

/**
 * Tìm array trong data để convert sang JSONL.
 *
 * Rule (theo priority):
 *   1. data là array → return trực tiếp
 *   2. data là object → tìm key có value là array
 *      - Có đúng 1 array key → return array đó (auto-detect thành công)
 *      - Có nhiều array key → return null với `candidates` để caller UI cho user chọn
 *   3. Không tìm được → return null, candidates = []
 */
export function findJsonlSource(data: unknown): {
  array: unknown[] | null;
  candidates: string[];
  pickedKey?: string;
} {
  if (Array.isArray(data)) return { array: data, candidates: [] };

  if (data && typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    const arrayKeys = entries.filter(([, v]) => Array.isArray(v)).map(([k]) => k);

    if (arrayKeys.length === 1) {
      const key = arrayKeys[0];
      return {
        array: (data as Record<string, unknown[]>)[key],
        candidates: [key],
        pickedKey: key,
      };
    }
    if (arrayKeys.length > 1) {
      return { array: null, candidates: arrayKeys };
    }
  }

  return { array: null, candidates: [] };
}

/** Convert array → JSONL: mỗi element → 1 dòng JSON. */
export function toJsonLines(array: unknown[]): string {
  return array.map((item) => JSON.stringify(item)).join('\n');
}

/**
 * Detect text có phải JSONL không: ≥ 2 dòng non-empty, mỗi dòng parse được
 * qua JSON.parse độc lập. Không throw — trả null nếu detect fail.
 */
export function detectJsonl(text: string): unknown[] | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  const out: unknown[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      return null;
    }
  }
  return out;
}

/**
 * Parse JSONL text — throws nếu fail. Dùng khi user explicit muốn convert
 * (không phải auto-detect).
 */
export function fromJsonLines(text: string): unknown[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new Error('Text rỗng, không có dòng JSON nào.');
  return lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`Line ${i + 1} không parse được: ${(err as Error).message}`);
    }
  });
}

// ============================================================
// Simple JSON helpers
// ============================================================

/** Simple pretty-print JSON với indent. */
export function prettyJson(data: unknown, indent = 2): string {
  return JSON.stringify(data, null, indent);
}

/** Minify JSON — 1 dòng. */
export function minifyJson(data: unknown): string {
  return JSON.stringify(data);
}

/** Chỉ dùng để re-export cho consumer khi cần typing readonly setup. */
export function readonlyExtensions() {
  return [EditorState.readOnly.of(true), EditorView.editable.of(false)];
}

/** No-op để force get extension để avoid tree-shake unused. */
export { getLanguageExtension };