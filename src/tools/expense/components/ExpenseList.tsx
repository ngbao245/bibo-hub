import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/moneyParse';
import {
  EXPENSE_CATEGORIES,
  dateInPeriod,
  type ExpenseDay,
  type ExpensePeriod,
  type ExpenseItem,
} from '@/lib/expense';

// ============================================================
// ExpenseList - hiển thị expenses theo ngày, group theo date
// ============================================================

interface ExpenseListProps {
  days: ExpenseDay[];
  period: ExpensePeriod;
  isLoading: boolean;
  onDelete: (date: string, itemId: string) => void;
}

export default function ExpenseList({
  days,
  period,
  isLoading,
  onDelete,
}: ExpenseListProps) {
  // Filter days theo period, vẫn giữ structure ngày
  const filtered = useMemo(() => {
    return days.filter((d) => dateInPeriod(d.date, period));
  }, [days, period]);

  const totalAmount = useMemo(() => {
    return filtered.reduce(
      (sum, d) => sum + d.items.reduce((s, it) => s + it.amount, 0),
      0,
    );
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Chưa có chi tiêu nào trong{' '}
            {period === 'today'
              ? 'hôm nay'
              : period === 'week'
                ? 'tuần này'
                : period === 'month'
                  ? 'tháng này'
                  : 'tất cả'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Gõ vào ô bên cạnh để thêm
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Total bar */}
      <div className="border-b border-border bg-card px-4 py-2 text-sm">
        <span className="text-muted-foreground">Tổng</span>{' '}
        <span className="font-semibold text-foreground">{formatMoney(totalAmount)}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((day) => (
          <DayGroup key={day.date} day={day} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
function DayGroup({
  day,
  onDelete,
}: {
  day: ExpenseDay;
  onDelete: (date: string, itemId: string) => void;
}) {
  const total = day.items.reduce((s, it) => s + it.amount, 0);
  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between bg-muted px-4 py-1.5 text-xs">
        <span className="text-muted-foreground">{formatDayLabel(day.date)}</span>
        <span className="font-mono text-foreground">{formatMoney(total)}</span>
      </div>
      <ul>
        {day.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            onDelete={() => onDelete(day.date, item.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function ItemRow({ item, onDelete }: { item: ExpenseItem; onDelete: () => void }) {
  const cat = EXPENSE_CATEGORIES[item.category as keyof typeof EXPENSE_CATEGORIES] ?? EXPENSE_CATEGORIES.other;
  const isAuto = item.meta?.keycapItemId || item.meta?.keycapLotId;

  return (
    <li
      className={cn(
        'group flex items-center gap-3 border-l-2 px-4 py-2.5 transition-colors hover:bg-popover/30',
      )}
      style={{ borderLeftColor: cat.color }}
    >
      <cat.Icon className="h-4 w-4 shrink-0" style={{ color: cat.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-foreground">{item.name}</span>
          {isAuto && (
            <span
              className="shrink-0 border border-primary/30 bg-primary/10 px-1 py-0.5 text-[9px] uppercase text-primary"
              title="Tự động tạo từ Keycap inventory"
            >
              auto
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground">{cat.label}</div>
      </div>
      <span className="font-mono text-sm font-semibold text-foreground">
        {formatMoney(item.amount)}
      </span>
      {!isAuto && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 opacity-0 hover:text-destructive group-hover:opacity-100"
          title="Xoá"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}

function formatDayLabel(date: string): string {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return `Hôm nay · ${date}`;
  if (diffDays === 1) return `Hôm qua · ${date}`;
  if (diffDays < 7) return `${diffDays} ngày trước · ${date}`;
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
}