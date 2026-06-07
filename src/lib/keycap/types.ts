import { Palette, Keyboard, Circle, Package, type LucideIcon } from 'lucide-react';

// ============================================================
// Keycap inventory types
// ============================================================
//
// Storage: 1 record duy nhất trong notes table với type='keycap_inventory'.
// content = JSON: { items: [...], lots: [...], groups: [...] }
//
// 'incoming' = đã đặt nhưng chưa nhận hàng
// ============================================================

export type ItemCategory = 'keycap' | 'keyboard' | 'switch' | 'other';
export type ItemStatus = 'available' | 'incoming' | 'sold';
export type SoldChannel = 'facebook' | 'shopee' | 'lazada' | 'friends' | 'other';

export interface KeycapItem {
  id: string;
  name: string;
  cat: ItemCategory;
  status: ItemStatus;

  /**
   * Giá vốn:
   * - Item lẻ (lotId=null): user nhập, không đổi
   * - Item trong lot: TỰ TÍNH theo Lot.totalBuyPrice + Lot.shippingCost,
   *   phân bổ theo tỷ lệ sellPrice trong lot.
   */
  buyPrice: number;
  sellPrice: number; // 0 = chưa biết, hoặc số > 0 (giá muốn bán)
  actualPrice: number; // Giá bán thực (khi status=sold)
  shippingCost: number; // Chỉ ý nghĩa với item lẻ

  buyDate: string; // YYYY-MM-DD
  soldDate: string | null;

  lotId: string | null;
  groupId: string | null;
  buyer: string;
  soldVia: SoldChannel | null;
  imageUrl: string;
  tags: string;
  note: string;
}

/**
 * Lot - 1 lô mua chung. Items trong lot chia sẻ vốn.
 */
export interface KeycapLot {
  id: string;
  name: string;
  totalBuyPrice: number;
  shippingCost: number;
  buyDate: string;
  groupId: string | null;
  note: string;
}

export interface KeycapGroup {
  id: string;
  name: string;
  url: string;
  members: string;
  note: string;
}

/** Toàn bộ data lưu trong 1 record */
export interface KeycapInventory {
  items: KeycapItem[];
  lots: KeycapLot[];
  groups: KeycapGroup[];
}

// ============================================================
// Constants
// ============================================================

export const ITEM_CATS: Record<ItemCategory, { label: string; Icon: LucideIcon }> = {
  keycap: { label: 'Keycap', Icon: Palette },
  keyboard: { label: 'Bàn phím', Icon: Keyboard },
  switch: { label: 'Switch', Icon: Circle },
  other: { label: 'Khác', Icon: Package },
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  available: 'Còn hàng',
  incoming: 'Đang về',
  sold: 'Đã bán',
};

export const STATUS_COLORS: Record<ItemStatus, string> = {
  available: 'text-green-500 bg-green-500/10 border-green-500/30',
  incoming: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
  sold: 'text-muted-foreground bg-muted border-border',
};

export const SOLD_CHANNELS: Record<SoldChannel, string> = {
  facebook: 'Facebook',
  shopee: 'Shopee',
  lazada: 'Lazada',
  friends: 'Bạn bè',
  other: 'Khác',
};
