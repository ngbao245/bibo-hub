import { formatMoney } from '@/lib/moneyParse';
import { cn } from '@/lib/cn';
import type { InventoryStats } from '@/lib/keycap/calc';

interface SummaryBarProps {
  stats: InventoryStats;
}

export default function SummaryBar({ stats }: SummaryBarProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border bg-card px-4 py-2">
      <Chip label="Tổng" value={String(stats.totalItems)} />
      <Chip label="Còn hàng" value={String(stats.available)} color="text-green-500" />
      <Chip label="Đang về" value={String(stats.incoming)} color="text-yellow-500" />
      <Chip label="Đã bán" value={String(stats.sold)} />
      <Chip label="Vốn giữ" value={formatMoney(stats.heldInvested)} color="text-yellow-500" />
      <Chip
        label="Lời thực"
        value={`${stats.realizedProfit >= 0 ? '+' : ''}${formatMoney(stats.realizedProfit)}`}
        color={stats.realizedProfit >= 0 ? 'text-green-500' : 'text-destructive'}
      />
      <Chip
        label="Tiềm năng"
        value={`${stats.unrealizedProfit >= 0 ? '+' : ''}${formatMoney(stats.unrealizedProfit)}`}
        color={stats.unrealizedProfit >= 0 ? 'text-green-500' : 'text-destructive'}
      />
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border bg-background px-2 py-1">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-xs font-semibold', color ?? 'text-foreground')}>{value}</div>
    </div>
  );
}
