import { z } from 'zod';
import {
  Utensils,
  Bike,
  ShoppingBag,
  Laptop,
  Keyboard,
  Plane,
  Gift,
  BookOpen,
  Pill,
  Pin,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// Expense types & helpers
// ============================================================
//
// Storage: notes table với type='expense'.
// 1 record / ngày → content = JSON array các expense items.
// source = "YYYY-MM-DD"
// ============================================================

export const EXPENSE_CATEGORIES: Record<
  string,
  { label: string; Icon: LucideIcon; color: string }
> = {
  food: { label: 'Ăn uống', Icon: Utensils, color: '#ff7043' },
  transport: { label: 'Di chuyển', Icon: Bike, color: '#42a5f5' },
  shopping: { label: 'Mua sắm', Icon: ShoppingBag, color: '#ab47bc' },
  tech: { label: 'Công nghệ', Icon: Laptop, color: '#26c6da' },
  keycap: { label: 'Keycap', Icon: Keyboard, color: '#7e57c2' },
  travel: { label: 'Du lịch', Icon: Plane, color: '#26a69a' },
  gift: { label: 'Quà tặng', Icon: Gift, color: '#ec407a' },
  course: { label: 'Khóa học', Icon: BookOpen, color: '#5c6bc0' },
  health: { label: 'Sức khỏe', Icon: Pill, color: '#66bb6a' },
  other: { label: 'Khác', Icon: Pin, color: '#78909c' },
};

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'tech'
  | 'keycap'
  | 'travel'
  | 'gift'
  | 'course'
  | 'health'
  | 'other';

export const ExpenseItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
  category: z.string(), // String, validate qua EXPENSE_CATEGORIES manually
  time: z.string().optional(),
  raw: z.string().optional(),
  /** Liên kết tới Keycap item / lot (set khi auto-tạo từ Keycap) */
  meta: z
    .object({
      keycapItemId: z.string().optional(),
      keycapLotId: z.string().optional(),
    })
    .optional(),
});

export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;

/** Một ngày — kèm record ID và items đã parse */
export interface ExpenseDay {
  date: string; // YYYY-MM-DD
  recordId: string | null;
  items: ExpenseItem[];
}

/** Parse content string (JSON) → ExpenseItem[] */
export function parseExpenseContent(content: string | null | undefined): ExpenseItem[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((it) => {
        const result = ExpenseItemSchema.safeParse(it);
        return result.success ? result.data : null;
      })
      .filter((it): it is ExpenseItem => it !== null);
  } catch {
    return [];
  }
}

// ============================================================
// Date helpers
// ============================================================

/** Today as "YYYY-MM-DD" theo local time */
export function todayString(): string {
  const d = new Date();
  return formatDate(d);
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Period filter: 'today' | 'week' | 'month' | 'all' */
export type ExpensePeriod = 'today' | 'week' | 'month' | 'all';

export function dateInPeriod(date: string, period: ExpensePeriod): boolean {
  if (period === 'all') return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (period === 'today') {
    return d.getTime() === today.getTime();
  }
  if (period === 'week') {
    // Tuần hiện tại (CN-T7), giả định tuần bắt đầu từ Thứ 2
    const dayOfWeek = (today.getDay() + 6) % 7; // 0 = T2, 6 = CN
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    return d >= monday && d <= today;
  }
  if (period === 'month') {
    return (
      d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
    );
  }
  return false;
}
