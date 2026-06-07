// ============================================================
// Money parser - "35k" → 35000, "1.5tr" → 1500000
// ============================================================
//
// Shared giữa Expense, Keycap, Savings (sau này unify).
// Hỗ trợ format Việt Nam:
//   "35k"     → 35000
//   "150k"    → 150000
//   "1tr"     → 1000000
//   "1.5tr"   → 1500000
//   "1m"      → 1000000   (alias 'm' = million)
//   "150"     → 150       (số nguyên không đơn vị)
//   "150000"  → 150000
//   "150.000" → 150000    (separator)
//   "150,000" → 150000
// ============================================================

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  tr: 1_000_000,
  triệu: 1_000_000,
  trieu: 1_000_000,
  ty: 1_000_000_000,
  tỷ: 1_000_000_000,
  tỉ: 1_000_000_000,
};

/** Parse string thành số. Trả về 0 nếu không parse được. */
export function parseMoney(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Math.round(input);
  if (!input) return 0;

  let s = String(input).trim().toLowerCase();
  if (!s) return 0;

  // "?" = sellPrice unknown — handled riêng ở keycap
  if (s === '?') return 0;

  // Tìm suffix
  for (const [suffix, mult] of Object.entries(SUFFIX_MULTIPLIERS)) {
    if (s.endsWith(suffix)) {
      const numPart = s.slice(0, -suffix.length).trim().replace(/[.,\s]/g, (m) =>
        // Cho phép "1.5k" — giữ dấu chấm cuối nếu có chữ số sau
        m === '.' ? '.' : '',
      );
      const n = parseFloat(numPart);
      return isNaN(n) ? 0 : Math.round(n * mult);
    }
  }

  // Không suffix → chỉ là số (loại bỏ . , space)
  const cleaned = s.replace(/[.,\s]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

/** Format VND: 150000 → "150.000đ" */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + 'đ';
}

/** Format short: 150000 → "150k", 1500000 → "1.5tr" */
export function formatMoneyShort(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'tr';
  }
  if (amount >= 1_000) {
    const k = amount / 1_000;
    return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'k';
  }
  return String(amount);
}

/** Format input: 150000 → "150.000" (cho input box, không có 'đ') */
export function formatMoneyInput(amount: number): string {
  if (!amount) return '';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount));
}
