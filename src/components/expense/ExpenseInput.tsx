import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/moneyParse';
import { parseExpenseInput } from '@/lib/expenseParser';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/expense';

// ============================================================
// ExpenseInput - input field với live preview parse
// ============================================================
//
// Khi user gõ → parse live → hiển thị category + amount preview.
// User có thể override category trước khi submit.
// ============================================================

interface ExpenseInputProps {
  onSubmit: (input: { name: string; amount: number; category: ExpenseCategory; raw: string }) => void;
  isPending: boolean;
}

export default function ExpenseInput({ onSubmit, isPending }: ExpenseInputProps) {
  const [text, setText] = useState('');
  const [overrideCategory, setOverrideCategory] = useState<ExpenseCategory | null>(null);

  const parsed = text.trim() ? parseExpenseInput(text) : null;
  const finalCategory = overrideCategory ?? parsed?.category ?? 'other';

  function submit() {
    if (!parsed) return;
    if (parsed.amount <= 0) return;
    onSubmit({
      name: parsed.name,
      amount: parsed.amount,
      category: finalCategory,
      raw: parsed.raw,
    });
    setText('');
    setOverrideCategory(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOverrideCategory(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder='vd: "cà phê 35k", "GMK keycap 800k", "xăng 50"'
          disabled={isPending}
          className="flex-1"
          autoFocus
        />
        <Button
          onClick={submit}
          disabled={isPending || !parsed || parsed.amount <= 0}
          size="default"
          className="gap-1.5"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Thêm
        </Button>
      </div>

      {/* Preview */}
      {parsed && (
        <div className="flex flex-wrap items-center gap-2 border border-dashed border-border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">→</span>
          <span className="font-medium text-foreground">
            {parsed.name || '(chưa có tên)'}
          </span>
          <span className="font-mono text-primary">
            {formatMoney(parsed.amount)}
          </span>
          {parsed.amount === 0 && (
            <span className="text-destructive">⚠ Số tiền chưa hợp lệ</span>
          )}

          {/* Category chips */}
          <div className="flex flex-wrap gap-1">
            {(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((cat) => {
              const c = EXPENSE_CATEGORIES[cat];
              const active = finalCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setOverrideCategory(cat)}
                  className={cn(
                    'flex items-center gap-1 border px-1.5 py-0.5 text-[11px] transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary',
                  )}
                  title={c.label}
                >
                  <c.Icon className="h-3 w-3" />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
