import {
  Wallet,
  PieChart,
  ShoppingCart,
  Users,
  Package,
  Trophy,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';

import { formatMoney } from '@/lib/moneyParse';
import { cn } from '@/lib/cn';
import { calculateStats, itemProfit } from '@/lib/keycap/calc';
import { ITEM_CATS, SOLD_CHANNELS, type KeycapItem, type KeycapLot, type KeycapGroup } from '@/lib/keycap/types';

interface StatsViewProps {
  items: KeycapItem[];
  lots: KeycapLot[];
  groups: KeycapGroup[];
}

export default function StatsView({ items, lots, groups }: StatsViewProps) {
  const stats = calculateStats(items, lots);

  if (items.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Chưa có dữ liệu</div>;
  }

  return (
    <div className="grid gap-4 overflow-y-auto p-4 md:grid-cols-2">
      {/* Financial overview */}
      <Section icon={Wallet} title="Tài chính">
        <Row label="Tổng vốn bỏ ra" value={formatMoney(stats.totalInvested)} color="text-warning" />
        <Row label="Vốn đang giữ" value={formatMoney(stats.heldInvested)} />
        <Row label="Doanh thu đã bán" value={formatMoney(stats.soldRevenue)} color="text-primary" />
        <Row
          label="Lời/lỗ thực tế"
          value={`${stats.realizedProfit >= 0 ? '+' : ''}${formatMoney(stats.realizedProfit)}`}
          color={stats.realizedProfit >= 0 ? 'text-success' : 'text-destructive'}
        />
        <Row
          label="Tiềm năng"
          value={`${stats.unrealizedProfit >= 0 ? '+' : ''}${formatMoney(stats.unrealizedProfit)}`}
          color={stats.unrealizedProfit >= 0 ? 'text-success' : 'text-destructive'}
        />
        {stats.sold > 0 && (
          <>
            <Row
              label="ROI bán"
              value={stats.soldCost > 0 ? `${((stats.realizedProfit / stats.soldCost) * 100).toFixed(1)}%` : '—'}
              color={stats.realizedProfit >= 0 ? 'text-success' : 'text-destructive'}
            />
            <Row label="TB ngày để bán" value={`${Math.round(stats.avgDaysToSell)} ngày`} />
          </>
        )}
      </Section>

      {/* By category */}
      <Section icon={PieChart} title="Theo loại">
        {stats.byCategory.map((c) => {
          const cat = ITEM_CATS[c.cat as keyof typeof ITEM_CATS] ?? { Icon: Package, label: c.cat };
          return (
            <Row
              key={c.cat}
              labelIcon={cat.Icon}
              label={`${cat.label} (${c.count})`}
              value={`${c.profit >= 0 ? '+' : ''}${formatMoney(c.profit)}`}
              color={c.profit >= 0 ? 'text-success' : 'text-destructive'}
            />
          );
        })}
      </Section>

      {/* By channel */}
      {stats.byChannel.length > 0 && (
        <Section icon={ShoppingCart} title="Kênh bán">
          {stats.byChannel.map((ch) => (
            <Row
              key={ch.channel}
              label={`${SOLD_CHANNELS[ch.channel as keyof typeof SOLD_CHANNELS] ?? ch.channel} (${ch.count})`}
              value={formatMoney(ch.revenue)}
              color="text-primary"
            />
          ))}
        </Section>
      )}

      {/* By group */}
      {stats.byGroup.length > 0 && (
        <Section icon={Users} title="Nguồn nhập">
          {stats.byGroup.map((g) => {
            const group = groups.find((gr) => gr.id === g.groupId);
            return (
              <Row
                key={g.groupId}
                label={`${group?.name ?? 'Unknown'} (${g.count})`}
                value={formatMoney(g.invested)}
              />
            );
          })}
        </Section>
      )}

      {/* By lot */}
      {stats.byLot.length > 0 && (
        <Section icon={Package} title="Lot">
          {stats.byLot.slice(0, 5).map((l) => {
            const lot = lots.find((lt) => lt.id === l.lotId);
            return (
              <Row
                key={l.lotId}
                label={`${lot?.name ?? 'Unknown'} (${l.itemCount})`}
                value={`${l.profit >= 0 ? '+' : ''}${formatMoney(l.profit)}`}
                color={l.profit >= 0 ? 'text-success' : 'text-destructive'}
              />
            );
          })}
        </Section>
      )}

      {/* Top profit */}
      {stats.topProfit.length > 0 && (
        <Section icon={Trophy} title="Lời nhất">
          {stats.topProfit.map((item) => (
            <Row
              key={item.id}
              label={item.name}
              value={`+${formatMoney(itemProfit(item))}`}
              color="text-success"
            />
          ))}
        </Section>
      )}

      {/* Top loss */}
      {stats.topLoss.length > 0 && (
        <Section icon={TrendingDown} title="Lỗ">
          {stats.topLoss.map((item) => (
            <Row
              key={item.id}
              label={item.name}
              value={formatMoney(itemProfit(item))}
              color="text-destructive"
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-card p-3">
      <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  label,
  labelIcon: LabelIcon,
  value,
  color,
}: {
  label: string;
  labelIcon?: LucideIcon;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-sm">
      <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
        {LabelIcon && <LabelIcon className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </span>
      <span className={cn('shrink-0 font-mono font-medium', color ?? 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}