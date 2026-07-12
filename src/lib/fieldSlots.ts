// ============================================================
// fieldSlots — encode/decode multiple FieldEntry per slot
// ============================================================
//
// Dùng cho MockAPI `/Config` records (10 slot config1..config10).
// Mỗi slot chứa JSON array `[{k, e, v}]`. `e` flag encrypt legacy —
// giờ luôn `e=0` cho record non-sensitive.
//
// Data sensitive đã move sang Supabase `app_settings` (plaintext + RLS).
// File này chỉ còn dùng cho RAG Config (non-sensitive filter setting).
// ============================================================

export interface FieldEntry {
  /** Label do user đặt */
  k: string;
  /** Cờ mã hoá legacy: 1 = ciphertext (chỉ đọc data cũ, không tạo mới). */
  e: 0 | 1;
  /** Giá trị plain (record mới) hoặc v1:base64 (record cũ). */
  v: string;
}

/** Budget tối đa mỗi slot (ký tự). 4KB an toàn cho mockapi. */
export const SLOT_BUDGET = 4096;

function normalizeEntry(raw: unknown): FieldEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.k !== 'string' || typeof o.v !== 'string') return null;
  if (o.e !== 0 && o.e !== 1) return null;
  return { k: o.k, e: o.e, v: o.v };
}

/**
 * Pack nhiều FieldEntry vào ÍT slot nhất có thể, tôn trọng budget.
 * Trả về string[] đã JSON.stringify; caller tự gán vào config1..N.
 */
export function encodeFieldSlots(entries: FieldEntry[]): string[] {
  if (entries.length === 0) return [];

  const slots: FieldEntry[][] = [];
  let current: FieldEntry[] = [];

  for (const e of entries) {
    const norm: FieldEntry = { k: e.k, e: e.e ? 1 : 0, v: e.v };
    const next = [...current, norm];
    const size = JSON.stringify(next).length;
    if (size > SLOT_BUDGET && current.length > 0) {
      slots.push(current);
      current = [norm];
    } else {
      current = next;
    }
  }
  if (current.length > 0) slots.push(current);

  return slots.map((arr) => JSON.stringify(arr));
}

/**
 * Decode 1 slot → danh sách FieldEntry (có thể nhiều).
 * Hỗ trợ:
 *   - Array of entries (format mới)
 *   - Single entry object (format cũ)
 *   - Plain string (legacy)
 */
export function decodeFieldSlots(slot: string, fallbackKey: string): FieldEntry[] {
  if (!slot) return [];
  try {
    const parsed = JSON.parse(slot);
    if (Array.isArray(parsed)) {
      const out: FieldEntry[] = [];
      for (const item of parsed) {
        const n = normalizeEntry(item);
        if (n) out.push(n);
      }
      return out;
    }
    const single = normalizeEntry(parsed);
    if (single) return [single];
  } catch {
    // plain
  }
  return [{ k: fallbackKey, e: 0, v: slot }];
}