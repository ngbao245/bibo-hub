import type { SourceFormat } from '../types';
import { parseJson, stringifyJson } from './json';
import { parseCsv, stringifyCsv } from './csv';
import { parseYaml, stringifyYaml } from './yaml';
import { parseXml, stringifyXml } from './xml';

// ============================================================
// Format facade - dispatch theo SourceFormat.
//
// Parse async (vì YAML / XML cần dynamic import). Stringify cũng async.
// CSV / JSON wrapper trong Promise để giữ uniform signature.
//
// Detect heuristic: dropdown là source of truth, detect chỉ dùng cho
// import file khi muốn auto-pick (theo extension trước, content sau).
// ============================================================

export interface FormatMeta {
  label: string;
  /** Extension (không kèm dấu chấm) dùng cho download filename. */
  extension: string;
  mime: string;
  /** Filename accept cho `<input type="file">`. */
  accept: string;
}

export const FORMAT_META: Record<SourceFormat, FormatMeta> = {
  json: {
    label: 'JSON',
    extension: 'json',
    mime: 'application/json',
    accept: '.json,application/json',
  },
  csv: {
    label: 'CSV',
    extension: 'csv',
    mime: 'text/csv',
    accept: '.csv,text/csv',
  },
  yaml: {
    label: 'YAML',
    extension: 'yaml',
    mime: 'application/yaml',
    accept: '.yaml,.yml,application/yaml,text/yaml',
  },
  xml: {
    label: 'XML',
    extension: 'xml',
    mime: 'application/xml',
    accept: '.xml,application/xml,text/xml',
  },
};

export const ALL_FORMATS: SourceFormat[] = ['json', 'yaml', 'xml', 'csv'];

/** Parse text theo format. Throw nếu fail. */
export async function parseByFormat(text: string, format: SourceFormat): Promise<unknown> {
  switch (format) {
    case 'json':
      return parseJson(text);
    case 'csv':
      return parseCsv(text);
    case 'yaml':
      return parseYaml(text);
    case 'xml':
      return parseXml(text);
  }
}

/**
 * Stringify data theo format.
 * - CSV trả null nếu data không phải array of records.
 * - Format khác throw nếu serialize fail.
 */
export async function stringifyByFormat(
  data: unknown,
  format: SourceFormat
): Promise<string | null> {
  switch (format) {
    case 'json':
      return stringifyJson(data, true);
    case 'csv':
      return stringifyCsv(data);
    case 'yaml':
      return stringifyYaml(data);
    case 'xml':
      return stringifyXml(data);
  }
}

/**
 * Heuristic detect format từ text content. Dùng làm fallback khi
 * import file mà extension không khớp dropdown chọn.
 *
 * Order: XML (rõ ràng nhất) → JSON → YAML flow-collection trá hình
 *        → CSV (delimiter + newline) → YAML (key:value pattern) → null.
 */
export function detectFormat(content: string): SourceFormat | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  // XML: bắt đầu bằng `<` không phải `</` hoặc có XML declaration.
  if (/^<\?xml\b/i.test(trimmed) || /^<[A-Za-z_][\w:.-]*[\s>/]/.test(trimmed)) {
    return 'xml';
  }

  // JSON: parse được = chắc chắn.
  try {
    JSON.parse(trimmed);
    return 'json';
  } catch {
    // fall through
  }

  // CSV: có dấu phẩy/tab + newline, không bắt đầu bằng { hay [.
  if (
    (trimmed.includes(',') || trimmed.includes('\t')) &&
    trimmed.includes('\n') &&
    !trimmed.startsWith('{') &&
    !trimmed.startsWith('[')
  ) {
    // Nhưng nếu có pattern `key: value` ở mỗi dòng → ưu tiên YAML.
    const lines = trimmed.split('\n').slice(0, 5);
    const yamlLike = lines.filter((l) => /^\s*[\w.-]+\s*:\s+\S/.test(l)).length;
    if (yamlLike >= 2 && yamlLike >= lines.length / 2) return 'yaml';
    return 'csv';
  }

  // YAML cuối: ít nhất 1 dòng `key: value`.
  if (/^[\w.-]+\s*:\s*\S/m.test(trimmed) || /^\s*-\s+\S/m.test(trimmed)) {
    return 'yaml';
  }

  return null;
}

/** Đoán format từ filename extension. */
export function formatFromFilename(name: string): SourceFormat | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) return 'csv';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.xml')) return 'xml';
  return null;
}