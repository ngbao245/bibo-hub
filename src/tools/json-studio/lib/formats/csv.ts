import Papa from 'papaparse';

// ============================================================
// CSV parse/stringify wrapper. PapaParse được dùng vì handle edge case tốt
// (quotes, escaped chars, multi-line fields).
// ============================================================

/** Parse CSV string thành array of records. Throw nếu fail hoàn toàn. */
export function parseCsv(csvText: string): Record<string, unknown>[] {
  const result = Papa.parse<Record<string, unknown>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`);
  }

  return result.data;
}

/**
 * Chuyển data thành CSV string. Trả null nếu không tìm thấy shape phù hợp.
 *
 * Heuristic (theo thứ tự):
 *   1. Array of plain objects → unparse trực tiếp.
 *   2. Array of primitives → CSV 1 cột "value".
 *   3. Object có 1 value là array of records → unwrap dùng array đó.
 *      (case phổ biến: `{ items: [...] }`, `{ fruits: [...] }`).
 *   4. Object phẳng (key→primitive/null) → CSV 1 row, columns = keys.
 *   5. Trả null cho các shape còn lại (nested object lồng sâu, mixed...).
 */
export function stringifyCsv(data: unknown): string | null {
  // 1 + 2. Array
  if (Array.isArray(data)) {
    if (data.length === 0) return '';
    const first = data[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return Papa.unparse(data as Record<string, unknown>[], { header: true });
    }
    if (data.every((v) => isPrimitive(v))) {
      return Papa.unparse(
        data.map((value) => ({ value })),
        { header: true }
      );
    }
    return null;
  }

  // 3 + 4. Object
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    // Tìm key đầu tiên có value là array of records.
    for (const value of Object.values(obj)) {
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        value[0] &&
        typeof value[0] === 'object' &&
        !Array.isArray(value[0])
      ) {
        return Papa.unparse(value as Record<string, unknown>[], { header: true });
      }
    }
    // Object phẳng → 1 row.
    if (Object.values(obj).every((v) => isPrimitive(v))) {
      return Papa.unparse([obj], { header: true });
    }
  }

  return null;
}

function isPrimitive(v: unknown): boolean {
  return v == null || typeof v !== 'object';
}