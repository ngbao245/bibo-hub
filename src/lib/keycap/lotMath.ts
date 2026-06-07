import type { KeycapItem, KeycapLot } from './types';

// ============================================================
// Lot math - phân bổ vốn cho items trong lot
// ============================================================
//
// Mỗi item trong lot có buyPrice TỰ TÍNH dựa vào:
//   totalCost = lot.totalBuyPrice + lot.shippingCost
//
// Phân bổ theo tỷ lệ sellPrice:
//   item.buyPrice = totalCost * (item.sellPrice / sumSellPrice)
//
// Edge cases:
// 1. sumSellPrice = 0 (tất cả items có sellPrice=0) → chia đều
// 2. Item có sellPrice = 0 → buyPrice = 0
// 3. Floating rounding → item cuối cùng nhận phần dư
// ============================================================

/**
 * Tính buyPrice cho từng item trong lot.
 * Trả về Map<itemId, buyPrice>.
 */
export function allocateLotBuyPrices(
  lot: KeycapLot,
  itemsInLot: KeycapItem[],
): Map<string, number> {
  const result = new Map<string, number>();
  if (itemsInLot.length === 0) return result;

  const totalCost = lot.totalBuyPrice + lot.shippingCost;
  const sumSellPrice = itemsInLot.reduce((s, i) => s + Math.max(0, i.sellPrice), 0);

  // Edge case 1: tất cả sellPrice=0 → chia đều
  if (sumSellPrice === 0) {
    const equal = Math.floor(totalCost / itemsInLot.length);
    let remainder = totalCost - equal * itemsInLot.length;
    for (const item of itemsInLot) {
      result.set(item.id, equal + (remainder > 0 ? 1 : 0));
      if (remainder > 0) remainder--;
    }
    return result;
  }

  // Phân bổ theo tỷ lệ sellPrice
  let allocated = 0;
  for (let i = 0; i < itemsInLot.length - 1; i++) {
    const item = itemsInLot[i];
    if (item.sellPrice <= 0) {
      result.set(item.id, 0);
      continue;
    }
    const share = Math.round(totalCost * (item.sellPrice / sumSellPrice));
    result.set(item.id, share);
    allocated += share;
  }
  // Item cuối nhận phần dư (chống floating rounding)
  const lastItem = itemsInLot[itemsInLot.length - 1];
  if (lastItem.sellPrice <= 0 && sumSellPrice > 0) {
    // Nếu item cuối có sellPrice=0 nhưng các item khác có → vẫn để 0
    result.set(lastItem.id, 0);
  } else {
    result.set(lastItem.id, totalCost - allocated);
  }
  return result;
}

/**
 * Apply allocation lên items, return items với buyPrice mới.
 * KHÔNG mutate input.
 */
export function applyLotAllocation(
  lot: KeycapLot,
  itemsInLot: KeycapItem[],
): KeycapItem[] {
  const allocation = allocateLotBuyPrices(lot, itemsInLot);
  return itemsInLot.map((item) => ({
    ...item,
    buyPrice: allocation.get(item.id) ?? 0,
  }));
}

/**
 * Re-allocate tất cả lots trong inventory.
 * Gọi sau mỗi mutation (add/update/delete item or lot).
 */
export function reallocateAllLots(
  items: KeycapItem[],
  lots: KeycapLot[],
): KeycapItem[] {
  const itemsByLot = new Map<string, KeycapItem[]>();
  const standalone: KeycapItem[] = [];

  for (const item of items) {
    if (item.lotId) {
      const arr = itemsByLot.get(item.lotId) ?? [];
      arr.push(item);
      itemsByLot.set(item.lotId, arr);
    } else {
      standalone.push(item);
    }
  }

  const result: KeycapItem[] = [...standalone];
  for (const lot of lots) {
    const lotItems = itemsByLot.get(lot.id) ?? [];
    if (lotItems.length === 0) continue;
    result.push(...applyLotAllocation(lot, lotItems));
  }

  // Items có lotId không hợp lệ (lot bị xoá) → orphans, treat as standalone
  for (const [lotId, lotItems] of itemsByLot) {
    const lotExists = lots.some((l) => l.id === lotId);
    if (!lotExists) {
      // Item orphan: giữ lotId = null + giữ buyPrice cũ (snapshot)
      for (const item of lotItems) {
        result.push({ ...item, lotId: null });
      }
    }
  }

  return result;
}
