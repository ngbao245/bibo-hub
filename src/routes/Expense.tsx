import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

import {
  useExpenses,
  useAddExpense,
  useDeleteExpense,
} from '@/api/expense';
import {
  todayString,
  type ExpensePeriod,
  type ExpenseItem,
} from '@/lib/expense';

import ExpenseInput from '@/components/expense/ExpenseInput';
import ExpenseList from '@/components/expense/ExpenseList';
import ExpenseStats from '@/components/expense/ExpenseStats';

// ============================================================
// Expense Page
// ============================================================

const PERIODS: { value: ExpensePeriod; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
  { value: 'all', label: 'Tất cả' },
];

export default function Expense() {
  const expensesQuery = useExpenses();
  const addExpense = useAddExpense();
  const deleteExpense = useDeleteExpense();

  const [period, setPeriod] = useState<ExpensePeriod>('today');
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');

  function handleAdd(input: {
    name: string;
    amount: number;
    category: string;
    raw: string;
  }) {
    const date = todayString();
    const item: ExpenseItem = {
      id: 'exp_' + Date.now(),
      name: input.name,
      amount: input.amount,
      category: input.category,
      time: new Date().toTimeString().slice(0, 5),
      raw: input.raw,
    };
    addExpense.mutate(
      { date, item },
      {
        onSuccess: () => toast.success(`Đã thêm: ${input.name}`),
        onError: () => toast.error('Lỗi thêm chi tiêu'),
      },
    );
  }

  function handleDelete(date: string, itemId: string) {
    if (!window.confirm('Xoá chi tiêu này?')) return;
    deleteExpense.mutate(
      { date, itemId },
      {
        onSuccess: () => toast.success('Đã xoá'),
        onError: () => toast.error('Lỗi xoá'),
      },
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Wallet className="h-4 w-4" />
            Chi tiêu
          </h1>
        </div>

        {/* Period filter */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'border px-2 py-1 text-xs transition-colors',
                period === p.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Input */}
      <div className="border-b border-border bg-card p-3">
        <ExpenseInput onSubmit={handleAdd} isPending={addExpense.isPending} />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'list' | 'stats')}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="border-b border-border px-3 pt-2">
          <TabsList>
            <TabsTrigger value="list">Danh sách</TabsTrigger>
            <TabsTrigger value="stats">Thống kê</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="m-0 flex flex-1 flex-col overflow-hidden">
          <ExpenseList
            days={expensesQuery.data ?? []}
            period={period}
            isLoading={expensesQuery.isLoading}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="stats" className="m-0 flex flex-1 flex-col overflow-hidden">
          <ExpenseStats
            days={expensesQuery.data ?? []}
            period={period}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
