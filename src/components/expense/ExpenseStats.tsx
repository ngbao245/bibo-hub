import { useMemo } from 'react';
import { formatMoney } from '@/lib/moneyParse';
import {
  EXPENSE_CATEGORIES,
  dateInPeriod,
  type ExpenseCategory,
  type ExpenseDay,
  type ExpensePeriod,
} from '@/lib/expense';

// ============================================================
// ExpenseStats - thống kê chi tiêu theo period
// ============================================================
//
// - Tổng chi
// - Top category (chart bar)
// - Số ngày có chi tiêu
// - Trung bình/ngày
// ============================================================

interface ExpenseStatsProps {
  days: ExpenseDay[];
  period: ExpensePeriod;
}

export default function ExpenseStats({ days, period }: ExpenseStatsProps) {
  const stats = useMemo(() => {
    const filtered = days.filter((d) => dateInPeriod(d.date, period));
    const total = filtered.reduce(
      (sum, d) => sum + d.items.reduce((s, it) => s + it.amount, 0),
      0,
    );
    const dayCount = filtered.filter((d) => d.items.length > 0).length;
    const avgPerDay = dayCount > 0 ? total / dayCount : 0;

    // By category
    const byCategory: Record<string, number> = {};
    for (const day of filtered) {
      for (const item of day.items) {
        byCategory[item.category] = (byCategory[item.category] ?? 0) + item.amount;
      }
    }

    const sortedCategories = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, amount]) => ({
        cat: cat as ExpenseCategory,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }));

    return { total, dayCount, avgPerDay, sortedCategories };
  }, [days, period]);

  if (stats.total === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Chưa có dữ liệu cho thống kê
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="Tổng chi" value={formatMoney(stats.total)} highlight />
        <SummaryCard label="Số ngày chi" value={`${stats.dayCount}`} />
        <SummaryCard label="TB/ngày" value={formatMoney(Math.round(stats.avgPerDay))} />
      </div>

      {/* By category */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Theo danh mục
        </h3>
        <div className="space-y-2">
          {stats.sortedCategories.map(({ cat, amount, pct }) => {
            const c = EXPENSE_CATEGORIES[cat] ?? EXPENSE_CATEGORIES.other;
            return (
              <div key={cat} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <c.Icon className="h-3.5 w-3.5" style={{ color: c.color }} />
                    <span className="text-foreground">{c.label}</span>
                    <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                  <span className="font-mono font-medium text-foreground">
                    {formatMoney(amount)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-background">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${pct}%`, background: c.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border bg-card px-3 py-2 ${
        highlight ? 'border-primary' : 'border-border'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`truncate text-sm font-semibold ${
          highlight ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
