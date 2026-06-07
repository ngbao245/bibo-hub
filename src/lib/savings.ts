import { z } from 'zod';

// ============================================================
// Savings types & helpers
// ============================================================
//
// V1 lưu savings vào table `notes` với type='savings'.
// Mapping field:
//   title    → name
//   url1     → targetAmount (string number)
//   url2     → currentAmount (string number)
//   url3     → deadline (days)
//   url4     → QR image (base64 data URL)
//   content  → history JSON
//   url5     → challenge JSON (bỏ qua ở v2 cho đơn giản)
// ============================================================

const HistoryEntrySchema = z.object({
  amount: z.number(),
  date: z.string(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: number;
  startDate: string;
  history: HistoryEntry[];
  qrImage: string | null;
}

/** Parse savings goal từ note record (mọi field là string trong MockAPI) */
export function parseSavingsGoal(record: Record<string, unknown>): SavingsGoal | null {
  if (!record.id) return null;
  return {
    id: String(record.id),
    name: typeof record.title === 'string' ? record.title : '',
    targetAmount: parseInt(String(record.url1 ?? '0'), 10) || 0,
    currentAmount: parseInt(String(record.url2 ?? '0'), 10) || 0,
    deadline: parseInt(String(record.url3 ?? '0'), 10) || 0,
    startDate: String(record.createdAt ?? new Date().toISOString()),
    history: parseHistory(record.content),
    qrImage: typeof record.url4 === 'string' && record.url4 ? record.url4 : null,
  };
}

function parseHistory(value: unknown): HistoryEntry[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return z.array(HistoryEntrySchema).parse(parsed);
  } catch {
    return [];
  }
}

/** Build payload để PUT/POST sang MockAPI */
export function toSavingsPayload(goal: SavingsGoal): Record<string, unknown> {
  return {
    title: goal.name,
    type: 'savings',
    content: JSON.stringify(goal.history),
    url1: String(goal.targetAmount),
    url2: String(goal.currentAmount),
    url3: String(goal.deadline),
    url4: goal.qrImage ?? '',
    url5: '',
  };
}

// ============================================================
// Format helpers
// ============================================================

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

/** Parse "10.000.000" / "10,000,000" / "10000000" → 10000000 */
export function parseMoneyInput(value: string): number {
  return parseInt(value.replace(/[.,\s]/g, ''), 10) || 0;
}

/** Format number → "10.000.000" cho input */
export function formatMoneyInput(value: number): string {
  if (!value) return '';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function calculateProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min((current / target) * 100, 100);
}

export function calculateDaysLeft(startDate: string, deadlineDays: number): number {
  const end = new Date(startDate);
  end.setDate(end.getDate() + deadlineDays);
  const diffMs = end.getTime() - Date.now();
  return Math.max(Math.ceil(diffMs / 86_400_000), 0);
}
