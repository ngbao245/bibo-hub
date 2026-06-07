import { useCallback, useState } from 'react';
import { PiggyBank, Trash2, Plus, RotateCcw, Sprout, Leaf, TreePine, Trophy } from 'lucide-react';

import { useShortcut } from '@/hooks/useShortcut';
import { useModalStore } from '@/stores/modalStore';
import { useSavings, useCreateSavings, useUpdateSavings, useDeleteSavings } from '@/api/savings';
import {
  formatMoney,
  formatMoneyInput,
  parseMoneyInput,
  calculateProgress,
  calculateDaysLeft,
  type SavingsGoal,
} from '@/lib/savings';

import ToolModal from '@/components/ToolModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';

// ============================================================
// Savings Modal
// ============================================================
//
// V2 đơn giản hoá so với v1:
// - Chỉ hỗ trợ 1 goal active
// - Bỏ challenge feature (có thể thêm sau)
// - Bỏ QR upload (có thể thêm sau)
// - Giữ: target amount, current, deadline (days), history, milestones, quick add
// ============================================================

const QUICK_AMOUNTS = [50_000, 100_000, 200_000, 500_000, 1_000_000];

export default function Savings() {
  const toggle = useModalStore((s) => s.toggle);
  const handleShortcut = useCallback(() => toggle('savings'), [toggle]);

  useShortcut({
    key: 'alt+shift+v',
    label: 'Savings',
    group: 'Tools',
    handler: handleShortcut,
  });

  return (
    <ToolModal id="savings" title="Tiết kiệm" className="max-w-xl">
      <SavingsContent />
    </ToolModal>
  );
}

function SavingsContent() {
  const query = useSavings();

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!query.data) return <CreateGoalForm />;
  return <ActiveGoal goal={query.data} />;
}

// ============================================================
// Create form
// ============================================================
function CreateGoalForm() {
  const create = useCreateSavings();
  const [name, setName] = useState('');
  const [targetText, setTargetText] = useState('');
  const [deadline, setDeadline] = useState('90');

  function submit() {
    const target = parseMoneyInput(targetText);
    const days = parseInt(deadline, 10);

    if (!name.trim() || target <= 0 || days <= 0) {
      toast.error('Vui lòng điền đầy đủ thông tin hợp lệ');
      return;
    }

    create.mutate(
      {
        name: name.trim(),
        targetAmount: target,
        currentAmount: 0,
        deadline: days,
        startDate: new Date().toISOString(),
        history: [],
        qrImage: null,
      },
      {
        onSuccess: () => toast.success('Đã tạo mục tiêu'),
        onError: () => toast.error('Lỗi tạo mục tiêu'),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-foreground">
        <PiggyBank className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">Tạo mục tiêu mới</h3>
      </div>

      <div className="space-y-3">
        <Field label="Tên mục tiêu">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Mua laptop mới"
          />
        </Field>

        <Field label="Số tiền mục tiêu (VND)">
          <Input
            value={targetText}
            onChange={(e) => {
              const num = parseMoneyInput(e.target.value);
              setTargetText(num ? formatMoneyInput(num) : '');
            }}
            placeholder="VD: 30.000.000"
            inputMode="numeric"
          />
        </Field>

        <Field label="Thời hạn (ngày)">
          <Input
            type="number"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            min="1"
          />
        </Field>

        <Button onClick={submit} disabled={create.isPending} className="w-full">
          {create.isPending ? 'Đang tạo...' : 'Bắt đầu tiết kiệm'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Active goal view
// ============================================================
function ActiveGoal({ goal }: { goal: SavingsGoal }) {
  const update = useUpdateSavings();
  const remove = useDeleteSavings();
  const [customAmount, setCustomAmount] = useState('');

  const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const daysLeft = calculateDaysLeft(goal.startDate, goal.deadline);
  const dailyTarget = daysLeft > 0 ? remaining / daysLeft : 0;

  function addAmount(amount: number) {
    if (amount <= 0) return;
    const actualAmount = Math.min(amount, remaining);
    if (actualAmount <= 0) {
      toast.info('Đã đạt mục tiêu rồi');
      return;
    }

    const updated: SavingsGoal = {
      ...goal,
      currentAmount: goal.currentAmount + actualAmount,
      history: [
        ...goal.history,
        { amount: actualAmount, date: new Date().toISOString() },
      ],
    };

    update.mutate(updated, {
      onSuccess: () => {
        // Celebrate milestone
        const oldProgress = calculateProgress(goal.currentAmount, goal.targetAmount);
        const newProgress = calculateProgress(updated.currentAmount, updated.targetAmount);
        for (const m of [25, 50, 75, 100]) {
          if (oldProgress < m && newProgress >= m) {
            toast.success(m === 100 ? 'Hoàn thành mục tiêu!' : `Đạt ${m}%!`);
            break;
          }
        }
      },
      onError: () => toast.error('Không lưu được'),
    });
  }

  function handleReset() {
    if (!window.confirm('Xoá mục tiêu hiện tại và tạo mới?')) return;
    remove.mutate(goal.id, {
      onSuccess: () => toast.success('Đã xoá'),
      onError: () => toast.error('Không xoá được'),
    });
  }

  return (
    <div className="space-y-4">
      <Header goal={goal} progress={progress} />

      <Stats
        remaining={remaining}
        daysLeft={daysLeft}
        dailyTarget={dailyTarget}
      />

      <Milestones progress={progress} />

      <QuickAdd
        onAdd={addAmount}
        customAmount={customAmount}
        onCustomChange={setCustomAmount}
        disabled={update.isPending || progress >= 100}
        remaining={remaining}
      />

      {goal.history.length > 0 && <HistoryList history={goal.history} />}

      <div className="flex gap-2 border-t border-border pt-3">
        <Button variant="outline" onClick={handleReset} className="flex-1 gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Tạo mục tiêu mới
        </Button>
      </div>
    </div>
  );
}

function Header({ goal, progress }: { goal: SavingsGoal; progress: number }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-foreground">{goal.name}</h3>
        <span className="font-mono text-sm text-primary">{progress.toFixed(1)}%</span>
      </div>

      <div className="mb-2 text-2xl font-semibold text-foreground">
        {formatMoney(goal.currentAmount)}
      </div>
      <div className="mb-3 text-xs text-muted-foreground">
        Mục tiêu: {formatMoney(goal.targetAmount)}
      </div>

      <div className="h-2 w-full bg-background">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function Stats({
  remaining,
  daysLeft,
  dailyTarget,
}: {
  remaining: number;
  daysLeft: number;
  dailyTarget: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatBox label="Còn thiếu" value={formatMoney(remaining)} />
      <StatBox label="Còn lại" value={`${daysLeft} ngày`} />
      <StatBox label="Mỗi ngày" value={formatMoney(dailyTarget)} />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Milestones({ progress }: { progress: number }) {
  const milestones = [
    { percent: 25, Icon: Sprout },
    { percent: 50, Icon: Leaf },
    { percent: 75, Icon: TreePine },
    { percent: 100, Icon: Trophy },
  ];

  return (
    <div className="flex justify-between gap-2">
      {milestones.map((m) => {
        const reached = progress >= m.percent;
        const Icon = m.Icon;
        return (
          <div
            key={m.percent}
            className={`flex flex-1 flex-col items-center border bg-background px-2 py-2 ${
              reached ? 'border-primary text-primary' : 'border-border text-muted-foreground'
            }`}
          >
            <Icon className="h-6 w-6" />
            <span className="mt-1 font-mono text-[10px]">{m.percent}%</span>
          </div>
        );
      })}
    </div>
  );
}

function QuickAdd({
  onAdd,
  customAmount,
  onCustomChange,
  disabled,
  remaining,
}: {
  onAdd: (amount: number) => void;
  customAmount: string;
  onCustomChange: (v: string) => void;
  disabled: boolean;
  remaining: number;
}) {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Thêm tiền
      </label>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((amount) => {
          const exceeded = amount > remaining;
          return (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              onClick={() => onAdd(amount)}
              disabled={exceeded || disabled}
              title={exceeded ? `Vượt còn thiếu ${formatMoney(remaining)}` : undefined}
              className="text-xs"
            >
              +{formatMoneyInput(amount)}
            </Button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Input
          value={customAmount}
          onChange={(e) => {
            const num = parseMoneyInput(e.target.value);
            onCustomChange(num ? formatMoneyInput(num) : '');
          }}
          placeholder="Nhập số tiền tuỳ chọn..."
          inputMode="numeric"
          className="flex-1"
          disabled={disabled}
        />
        <Button
          onClick={() => {
            const amount = parseMoneyInput(customAmount);
            if (amount > 0) {
              onAdd(amount);
              onCustomChange('');
            }
          }}
          disabled={!customAmount || disabled}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Thêm
        </Button>
      </div>
    </div>
  );
}

function HistoryList({ history }: { history: SavingsGoal['history'] }) {
  return (
    <details className="border border-border bg-card">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
        Lịch sử ({history.length})
      </summary>
      <ul className="max-h-48 overflow-y-auto border-t border-border">
        {[...history].reverse().map((entry, i) => (
          <li
            key={i}
            className="flex items-center justify-between border-b border-border px-3 py-1.5 text-sm last:border-b-0"
          >
            <span className="font-medium text-primary">+{formatMoney(entry.amount)}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date(entry.date).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

// Trash2 import giữ tránh "unused"
void Trash2;
