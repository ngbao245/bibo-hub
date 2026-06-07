import type { KeycapItem, KeycapLot } from './types';

// ============================================================
// Profit & stats calculations
// ============================================================

/** Profit của 1 item */
export function itemProfit(item: KeycapItem): number {
  if (item.status === 'sold') {
    return (item.actualPrice || item.sellPrice) - item.buyPrice;
  }
  return item.sellPrice - item.buyPrice;
}

/** Profit % */
export function itemProfitPct(item: KeycapItem): number {
  if (item.buyPrice <= 0) return 0;
  return (itemProfit(item) / item.buyPrice) * 100;
}

/** Số ngày giữ hàng. Nếu sold → từ buyDate đến soldDate. Chưa bán → đến hôm nay. */
export function itemDaysHeld(item: KeycapItem): number {
  const start = new Date(item.buyDate);
  const end = item.soldDate ? new Date(item.soldDate) : new Date();
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

// ============================================================
// Aggregate stats
// ============================================================

export interface InventoryStats {
  totalItems: number;
  available: number;
  incoming: number;
  sold: number;

  totalInvested: number; // Vốn đã bỏ ra (mọi items)
  heldInvested: number;  // Vốn đang giữ (chưa bán)
  soldRevenue: number;   // Tiền thu về từ sold
  soldCost: number;      // Vốn của items đã bán
  realizedProfit: number; // Lời thực tế
  unrealizedProfit: number; // Lời tiềm năng

  avgDaysToSell: number;

  byCategory: Array<{ cat: string; count: number; profit: number }>;
  byChannel: Array<{ channel: string; revenue: number; count: number }>;
  byGroup: Array<{ groupId: string; count: number; invested: number }>;
  byLot: Array<{ lotId: string; profit: number; itemCount: number }>;

  topProfit: KeycapItem[];
  topLoss: KeycapItem[];
}

export function calculateStats(items: KeycapItem[], lots: KeycapLot[]): InventoryStats {
  const available = items.filter((i) => i.status === 'available');
  const incoming = items.filter((i) => i.status === 'incoming');
  const sold = items.filter((i) => i.status === 'sold');

  const totalInvested = items.reduce((s, i) => s + i.buyPrice + i.shippingCost, 0);
  const heldInvested = [...available, ...incoming].reduce(
    (s, i) => s + i.buyPrice + i.shippingCost,
    0,
  );
  const soldRevenue = sold.reduce((s, i) => s + (i.actualPrice || i.sellPrice), 0);
  const soldCost = sold.reduce((s, i) => s + i.buyPrice + i.shippingCost, 0);
  const realizedProfit = soldRevenue - soldCost;
  const unrealizedProfit = available.reduce(
    (s, i) => s + (i.sellPrice - i.buyPrice),
    0,
  );

  const daysList = sold.map(itemDaysHeld);
  const avgDaysToSell =
    daysList.length > 0 ? daysList.reduce((s, d) => s + d, 0) / daysList.length : 0;

  // By category
  const catMap = new Map<string, { count: number; profit: number }>();
  for (const item of items) {
    const e = catMap.get(item.cat) ?? { count: 0, profit: 0 };
    e.count++;
    e.profit += itemProfit(item);
    catMap.set(item.cat, e);
  }
  const byCategory = Array.from(catMap.entries())
    .map(([cat, v]) => ({ cat, ...v }))
    .sort((a, b) => b.count - a.count);

  // By channel (sold only)
  const channelMap = new Map<string, { revenue: number; count: number }>();
  for (const item of sold) {
    if (!item.soldVia) continue;
    const e = channelMap.get(item.soldVia) ?? { revenue: 0, count: 0 };
    e.revenue += item.actualPrice || item.sellPrice;
    e.count++;
    channelMap.set(item.soldVia, e);
  }
  const byChannel = Array.from(channelMap.entries())
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // By group
  const groupMap = new Map<string, { count: number; invested: number }>();
  for (const item of items) {
    if (!item.groupId) continue;
    const e = groupMap.get(item.groupId) ?? { count: 0, invested: 0 };
    e.count++;
    e.invested += item.buyPrice + item.shippingCost;
    groupMap.set(item.groupId, e);
  }
  const byGroup = Array.from(groupMap.entries())
    .map(([groupId, v]) => ({ groupId, ...v }))
    .sort((a, b) => b.count - a.count);

  // By lot
  const byLot = lots
    .map((lot) => {
      const lotItems = items.filter((i) => i.lotId === lot.id);
      const profit = lotItems.reduce((s, i) => s + itemProfit(i), 0);
      return { lotId: lot.id, profit, itemCount: lotItems.length };
    })
    .filter((l) => l.itemCount > 0)
    .sort((a, b) => b.profit - a.profit);

  // Top profit/loss (sold only)
  const topProfit = [...sold].sort((a, b) => itemProfit(b) - itemProfit(a)).slice(0, 5);
  const topLoss = [...sold]
    .filter((i) => itemProfit(i) < 0)
    .sort((a, b) => itemProfit(a) - itemProfit(b))
    .slice(0, 5);

  return {
    totalItems: items.length,
    available: available.length,
    incoming: incoming.length,
    sold: sold.length,
    totalInvested,
    heldInvested,
    soldRevenue,
    soldCost,
    realizedProfit,
    unrealizedProfit,
    avgDaysToSell,
    byCategory,
    byChannel,
    byGroup,
    byLot,
    topProfit,
    topLoss,
  };
}
