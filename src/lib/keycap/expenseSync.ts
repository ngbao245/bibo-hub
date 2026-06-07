import type { ExpenseDay, ExpenseItem } from '@/lib/expense';
import type { KeycapItem, KeycapLot } from './types';

// ============================================================
// Sync Keycap → Expense
// ============================================================
//
// Khi user thêm Keycap item lẻ HOẶC tạo Lot:
//   → Tự tạo expense entry tương ứng vào ngày buyDate
//
// Khi user sửa buyPrice/shippingCost:
//   → Update entry hiện có (theo meta.keycapItemId / meta.keycapLotId)
//
// Khi user xoá Keycap item/lot:
//   → KHÔNG xoá expense (tiền đã chi)
//
// Logic dồn vào helpers thuần (không call API), component sẽ dispatch.
// ============================================================

/**
 * Build expense item từ keycap item lẻ (lotId=null, buyPrice>0).
 * Trả null nếu không cần tạo (đã thuộc lot, hoặc buyPrice=0).
 */
export function buildExpenseFromItem(item: KeycapItem): ExpenseItem | null {
  if (item.lotId) return null;
  const total = item.buyPrice + item.shippingCost;
  if (total <= 0) return null;
  return {
    id: `exp_kc_item_${item.id}`,
    name: `Keycap: ${item.name}`,
    amount: total,
    category: 'keycap',
    time: undefined,
    raw: '',
    meta: { keycapItemId: item.id },
  };
}

/** Build expense item từ lot (luôn tạo nếu totalCost > 0) */
export function buildExpenseFromLot(lot: KeycapLot): ExpenseItem | null {
  const total = lot.totalBuyPrice + lot.shippingCost;
  if (total <= 0) return null;
  return {
    id: `exp_kc_lot_${lot.id}`,
    name: `Lot: ${lot.name}`,
    amount: total,
    category: 'keycap',
    time: undefined,
    raw: '',
    meta: { keycapLotId: lot.id },
  };
}

/**
 * Apply sync: thêm/cập nhật/xoá entries trong expense days.
 * Trả về days mới đã sync.
 *
 * Logic:
 * 1. Tìm tất cả expense entries liên quan tới Keycap (meta.keycapItemId/LotId)
 * 2. So với current items + lots:
 *    - Item/Lot có buyPrice > 0 + chưa có entry → tạo
 *    - Item/Lot có entry nhưng amount khác → update
 *    - Entry tồn tại nhưng item/lot đã không còn → giữ (không xoá)
 */
export function syncExpensesFromKeycap(
  days: ExpenseDay[],
  items: KeycapItem[],
  lots: KeycapLot[],
): ExpenseDay[] {
  const desired = new Map<string, { date: string; item: ExpenseItem }>();

  for (const item of items) {
    const built = buildExpenseFromItem(item);
    if (built) desired.set(built.id, { date: item.buyDate, item: built });
  }
  for (const lot of lots) {
    const built = buildExpenseFromLot(lot);
    if (built) desired.set(built.id, { date: lot.buyDate, item: built });
  }

  // Clone days, mutate
  const dayMap = new Map<string, ExpenseDay>();
  for (const d of days) dayMap.set(d.date, { ...d, items: [...d.items] });

  // Pass 1: Update / remove auto items mismatched
  for (const day of dayMap.values()) {
    day.items = day.items.filter((it) => {
      // Giữ items không phải auto
      if (!it.id.startsWith('exp_kc_')) return true;
      // Auto entry tồn tại trong desired & cùng date → giữ (sẽ update bằng pass 2)
      const want = desired.get(it.id);
      if (want && want.date === day.date) return true;
      // Wrong date hoặc không còn desired → bỏ khỏi day này (move sang day đúng ở pass 3, hoặc xoá)
      return false;
    });
  }

  // Pass 2: Update amount
  for (const [id, want] of desired) {
    const day = dayMap.get(want.date);
    if (!day) continue;
    const idx = day.items.findIndex((it) => it.id === id);
    if (idx >= 0) {
      day.items[idx] = want.item;
    }
  }

  // Pass 3: Add new entries
  for (const [id, want] of desired) {
    const day = dayMap.get(want.date);
    if (day && day.items.some((it) => it.id === id)) continue; // already exists
    const targetDay = dayMap.get(want.date) ?? {
      date: want.date,
      recordId: null,
      items: [],
    };
    if (!targetDay.items.some((it) => it.id === id)) {
      targetDay.items.push(want.item);
    }
    dayMap.set(want.date, targetDay);
  }

  return Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}
