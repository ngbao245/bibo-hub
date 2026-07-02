import { Edit, Trash2, ShoppingBag, ImageIcon, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/moneyParse';
import { itemProfit, itemProfitPct, itemDaysHeld } from '@/lib/keycap/calc';
import { ITEM_CATS, STATUS_LABELS, STATUS_COLORS, type KeycapItem } from '@/lib/keycap/types';

interface ItemCardProps {
  item: KeycapItem;
  lotName?: string;
  groupName?: string;
  onEdit: () => void;
  onMarkSold: () => void;
  onDelete: () => void;
}

export default function ItemCard({
  item,
  lotName,
  groupName,
  onEdit,
  onMarkSold,
  onDelete,
}: ItemCardProps) {
  const profit = itemProfit(item);
  const profitPct = itemProfitPct(item);
  const days = itemDaysHeld(item);
  const cat = ITEM_CATS[item.cat];
  const sellDisplay = item.status === 'sold'
    ? (item.actualPrice || item.sellPrice)
    : item.sellPrice;

  return (
    <div className="group border border-border bg-card transition-colors hover:border-primary">
      <div className="flex items-start gap-3 p-3">
        {/* Thumbnail hoặc cat icon */}
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-10 w-10 shrink-0 border border-border object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-background">
            <cat.Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className={cn('truncate text-sm font-medium', item.status === 'sold' && 'line-through text-muted-foreground')}>
                {item.name}
              </h4>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                <span className={cn('border px-1 py-0.5', STATUS_COLORS[item.status])}>
                  {STATUS_LABELS[item.status]}
                </span>
                {lotName && <span title="Lot">📦 {lotName}</span>}
                {groupName && <span title="Group">👥 {groupName}</span>}
                {item.tags && <span>🏷️ {item.tags}</span>}
              </div>
            </div>

            {/* Profit badge */}
            {(item.sellPrice > 0 || item.status === 'sold') && (
              <span
                className={cn(
                  'shrink-0 px-1.5 py-0.5 font-mono text-xs font-semibold',
                  profit >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
                )}
              >
                {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                <span className="ml-0.5 text-[9px] opacity-70">{profitPct.toFixed(0)}%</span>
              </span>
            )}
          </div>

          {/* Prices row */}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              ↓ {item.buyPrice > 0 ? formatMoney(item.buyPrice) : '—'}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className={cn(item.status === 'sold' ? 'font-medium text-primary' : 'text-foreground')}>
              ↑ {sellDisplay > 0 ? formatMoney(sellDisplay) : '?'}
            </span>
          </div>

          {/* Meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {days} ngày
            </span>
            {item.buyer && <span>→ {item.buyer}</span>}
            {item.note && <span className="truncate italic max-w-[120px]">{item.note}</span>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-border opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 flex-1 gap-1.5 text-xs">
          <Edit className="h-3 w-3" />
          Sửa
        </Button>
        {item.status !== 'sold' && (
          <Button variant="ghost" size="sm" onClick={onMarkSold} className="h-7 flex-1 gap-1.5 text-xs text-success">
            <ShoppingBag className="h-3 w-3" />
            Đã bán
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 flex-1 gap-1.5 text-xs text-destructive">
          <Trash2 className="h-3 w-3" />
          Xoá
        </Button>
      </div>
    </div>
  );
}

void ImageIcon; // keep import for potential future use