import { z } from 'zod';

// ============================================================
// Note Schema - phản ánh đúng schema MockAPI từ v1
// ============================================================
//
// Table `notes` chứa nhiều loại note phân biệt qua field `type`:
// - 'note' / 'ielts' / 'course' / 'code': note thường
// - 'secret': secret note (Secret modal)
// - 'source': source note (Sources page)
// ============================================================

export const NoteTypeSchema = z.enum([
  'note',
  'ielts',
  'course',
  'code',
  'secret',
  'source',
  'savings',
  'order',
]);
export type NoteType = z.infer<typeof NoteTypeSchema>;

/** 4 type chính cho Notes app (không gồm secret/source/savings/movie/series/order) */
export const REGULAR_NOTE_TYPES: NoteType[] = ['note', 'ielts', 'course', 'code'];

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string().nullish().transform((v) => v ?? ''),
  content: z.string().nullish().transform((v) => v ?? ''),
  type: NoteTypeSchema.nullish().transform((v) => v ?? 'note'),
  source: z.string().nullish(),
  tags: z.string().nullish(),
  example: z.string().nullish(),
  url1: z.string().nullish(),
  url2: z.string().nullish(),
  url3: z.string().nullish(),
  url4: z.string().nullish(),
  url5: z.string().nullish(),
  wordCountEnabled: z.boolean().nullish(),
  timerDuration: z.string().nullish(),
  linkedNotes: z.array(z.string()).nullish().transform((v) => v ?? []),
  isChildNote: z.boolean().nullish().transform((v) => v ?? false),
  parentNoteId: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});

export type Note = z.infer<typeof NoteSchema>;

/** Parse mảng notes từ API, bỏ qua records không hợp lệ */
export function parseNotes(records: unknown[]): Note[] {
  const result: Note[] = [];
  for (const record of records) {
    const parsed = NoteSchema.safeParse(record);
    if (parsed.success) result.push(parsed.data);
  }
  return result;
}

// ============================================================
// DB Row Schema (snake_case) — for workspace Supabase response
// ============================================================

export const NoteRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string().default(''),
  content: z.string().default(''),
  type: NoteTypeSchema.default('note'),
  source: z.string().nullish(),
  tags: z.string().nullish(),
  example: z.string().nullish(),
  url1: z.string().nullish(),
  url2: z.string().nullish(),
  url3: z.string().nullish(),
  url4: z.string().nullish(),
  url5: z.string().nullish(),
  word_count_enabled: z.boolean().default(false),
  timer_duration: z.string().nullish(),
  linked_notes: z.array(z.string()).default([]),
  is_child_note: z.boolean().default(false),
  parent_note_id: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type NoteRowZ = z.infer<typeof NoteRowSchema>;