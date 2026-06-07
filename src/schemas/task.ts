import { z } from 'zod';

// ============================================================
// Task Schema - phản ánh đúng schema MockAPI từ v1
// ============================================================
//
// Table `tasks` có 2 type: 'task' (todo) và 'list' (custom list).
// Dùng discriminated union để TS ép check `type` trước khi access field.
//
// MockAPI hay trả null/undefined không nhất quán → schema dùng nullish().
// ============================================================

// Coerce: MockAPI có thể trả string HOẶC number cho date fields / misc fields.
// Chấp nhận bất kỳ → convert thành string | null.
const flexString = z.unknown().transform((v) => {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
});

// Field chung
const BaseSchema = z.object({
  id: z.string(),
  title: z.string().nullish().transform((v) => v ?? ''),
  createdAt: flexString,
  updatedAt: flexString,
});

// Task: 1 todo item
export const TaskSchema = BaseSchema.extend({
  type: z.literal('task').or(z.undefined()).transform(() => 'task' as const),
  description: flexString,
  parentId: flexString,
  status: z.enum(['pending', 'completed']).nullish().transform((v) => v ?? 'pending'),
  priority: z.enum(['normal', 'high']).nullish().transform((v) => v ?? 'normal'),
  dueDate: flexString,
  recurring: z.unknown().transform((v) => v === true || v === 'true'),
  url1: flexString,
  url2: flexString,
  url3: flexString,
  completedDate: flexString,
});

// List: nhóm chứa nhiều task
export const ListSchema = BaseSchema.extend({
  type: z.literal('list'),
  name: z.string().nullish(),
});

export type Task = z.infer<typeof TaskSchema>;
export type List = z.infer<typeof ListSchema>;

// API response là mảng hỗn hợp task + list. Tách bằng field `type`.
export const TaskApiResponseSchema = z.array(z.unknown());

/** Phân loại records từ API thành tasks và lists, bỏ qua records không hợp lệ */
export function parseTaskRecords(records: unknown[]): { tasks: Task[]; lists: List[] } {
  const tasks: Task[] = [];
  const lists: List[] = [];

  for (const record of records) {
    // Test type field trước để chọn schema phù hợp
    const r = record as { type?: unknown };
    if (r.type === 'list') {
      const parsed = ListSchema.safeParse(record);
      if (parsed.success) lists.push(parsed.data);
    } else {
      // type === 'task' hoặc không có type → coi như task
      const parsed = TaskSchema.safeParse(record);
      if (parsed.success) tasks.push(parsed.data);
    }
  }

  return { tasks, lists };
}
