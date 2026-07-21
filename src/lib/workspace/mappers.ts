// ============================================================
// Row mappers — snake_case DB rows ↔ camelCase domain types
// ============================================================
//
// Pure functions, no side effects.
// Used by api/notes.ts, api/tasks.ts, api/bookmarks.ts to translate
// between Supabase workspace rows and application domain types.
// ============================================================

import type { Note } from '@/schemas/note';
import type { Task, List } from '@/schemas/task';

// ============================================================
// Notes
// ============================================================

export interface NoteRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: string;
  source: string | null;
  tags: string | null;
  example: string | null;
  url1: string | null;
  url2: string | null;
  url3: string | null;
  url4: string | null;
  url5: string | null;
  word_count_enabled: boolean;
  timer_duration: string | null;
  linked_notes: string[];
  is_child_note: boolean;
  parent_note_id: string | null;
  created_at: string;
  updated_at: string;
}

export function noteRowToDomain(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type as Note['type'],
    source: row.source ?? null,
    tags: row.tags ?? null,
    example: row.example ?? null,
    url1: row.url1 ?? null,
    url2: row.url2 ?? null,
    url3: row.url3 ?? null,
    url4: row.url4 ?? null,
    url5: row.url5 ?? null,
    wordCountEnabled: row.word_count_enabled ?? null,
    timerDuration: row.timer_duration ?? null,
    linkedNotes: row.linked_notes ?? [],
    isChildNote: row.is_child_note ?? false,
    parentNoteId: row.parent_note_id ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export interface NoteInsertRow {
  user_id: string;
  title: string;
  content: string;
  type: string;
  source?: string | null;
  tags?: string | null;
  example?: string | null;
  url1?: string | null;
  url2?: string | null;
  url3?: string | null;
  url4?: string | null;
  url5?: string | null;
  word_count_enabled?: boolean;
  timer_duration?: string | null;
  linked_notes?: string[];
  is_child_note?: boolean;
  parent_note_id?: string | null;
}

export function noteInputToRow(
  input: Partial<Note> & { title: string },
  userId: string,
): NoteInsertRow {
  return {
    user_id: userId,
    title: input.title,
    content: input.content ?? '',
    type: input.type ?? 'note',
    source: input.source ?? null,
    tags: input.tags ?? null,
    example: input.example ?? null,
    url1: input.url1 ?? null,
    url2: input.url2 ?? null,
    url3: input.url3 ?? null,
    url4: input.url4 ?? null,
    url5: input.url5 ?? null,
    word_count_enabled: input.wordCountEnabled ?? false,
    timer_duration: input.timerDuration ?? null,
    linked_notes: input.linkedNotes ?? [],
    is_child_note: input.isChildNote ?? false,
    parent_note_id: input.parentNoteId ?? null,
  };
}

/** Build partial row for UPDATE (no user_id needed, DB keeps it). */
export function noteToUpdateRow(
  note: Note,
): Omit<NoteInsertRow, 'user_id'> & { id: string } {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    type: note.type,
    source: note.source ?? null,
    tags: note.tags ?? null,
    example: note.example ?? null,
    url1: note.url1 ?? null,
    url2: note.url2 ?? null,
    url3: note.url3 ?? null,
    url4: note.url4 ?? null,
    url5: note.url5 ?? null,
    word_count_enabled: note.wordCountEnabled ?? false,
    timer_duration: note.timerDuration ?? null,
    linked_notes: note.linkedNotes ?? [],
    is_child_note: note.isChildNote ?? false,
    parent_note_id: note.parentNoteId ?? null,
  };
}

// ============================================================
// Tasks
// ============================================================

export interface TaskRow {
  id: string;
  user_id: string;
  list_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  recurring: boolean;
  url1: string | null;
  url2: string | null;
  url3: string | null;
  completed_date: string | null;
  created_at: string;
  updated_at: string;
}

export function taskRowToDomain(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    type: 'task' as const,
    description: row.description ?? null,
    parentId: row.list_id ?? null,
    status: (row.status as 'pending' | 'completed') ?? 'pending',
    priority: (row.priority as 'normal' | 'high') ?? 'normal',
    dueDate: row.due_date ?? null,
    recurring: row.recurring ?? false,
    url1: row.url1 ?? null,
    url2: row.url2 ?? null,
    url3: row.url3 ?? null,
    completedDate: row.completed_date ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export interface TaskInsertRow {
  user_id: string;
  list_id?: string | null;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  due_date?: string | null;
  recurring?: boolean;
  url1?: string | null;
  url2?: string | null;
  url3?: string | null;
  completed_date?: string | null;
}

export function taskInputToRow(
  input: { title: string; description?: string | null; dueDate?: string | null; priority?: string; recurring?: boolean; parentId?: string | null; url1?: string | null; url2?: string | null; url3?: string | null },
  userId: string,
): TaskInsertRow {
  return {
    user_id: userId,
    title: input.title,
    description: input.description ?? null,
    status: 'pending',
    priority: input.priority ?? 'normal',
    due_date: input.dueDate ?? null,
    recurring: input.recurring ?? false,
    list_id: input.parentId ?? null,
    url1: input.url1 ?? null,
    url2: input.url2 ?? null,
    url3: input.url3 ?? null,
  };
}

/** Build row for full UPDATE from domain Task. */
export function taskToUpdateRow(task: Task): Omit<TaskInsertRow, 'user_id'> & { id: string; completed_date?: string | null } {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate ?? null,
    recurring: task.recurring,
    list_id: task.parentId ?? null,
    url1: task.url1 ?? null,
    url2: task.url2 ?? null,
    url3: task.url3 ?? null,
    completed_date: task.completedDate ?? null,
  };
}

// ============================================================
// Task Lists
// ============================================================

export interface TaskListRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function listRowToDomain(row: TaskListRow): List {
  return {
    id: row.id,
    title: row.name,
    type: 'list' as const,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function listInputToRow(title: string, userId: string): { user_id: string; name: string } {
  return { user_id: userId, name: title };
}

// ============================================================
// Bookmarks
// ============================================================

export type BookmarkCategory = 'movie' | 'series' | 'manga' | 'anime' | 'other';
export type BookmarkStatus = 'plan' | 'watching' | 'completed' | 'dropped';

export interface Bookmark {
  id: string;
  title: string;
  category: BookmarkCategory;
  status: BookmarkStatus;
  rating: number | null;
  note: string;
  url: string;
  imageUrl: string | null;
  year: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BookmarkRow {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: string;
  rating: number | null;
  note: string | null;
  url: string | null;
  image_url: string | null;
  year: number | null;
  created_at: string;
  updated_at: string;
}

export function bookmarkRowToDomain(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    title: row.title,
    category: (row.category as BookmarkCategory) ?? 'movie',
    status: (row.status as BookmarkStatus) ?? 'plan',
    rating: row.rating ?? null,
    note: row.note ?? '',
    url: row.url ?? '',
    imageUrl: row.image_url ?? null,
    year: row.year ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export interface BookmarkInsertRow {
  user_id: string;
  title: string;
  category?: string;
  status?: string;
  rating?: number | null;
  note?: string | null;
  url?: string | null;
  image_url?: string | null;
  year?: number | null;
}

export function bookmarkInputToRow(
  input: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
): BookmarkInsertRow {
  return {
    user_id: userId,
    title: input.title,
    category: input.category ?? 'movie',
    status: input.status ?? 'plan',
    rating: input.rating ?? null,
    note: input.note || null,
    url: input.url || null,
    image_url: input.imageUrl ?? null,
    year: input.year ?? null,
  };
}

/** Build row for UPDATE. */
export function bookmarkToUpdateRow(
  bookmark: Bookmark,
): Omit<BookmarkInsertRow, 'user_id'> & { id: string } {
  return {
    id: bookmark.id,
    title: bookmark.title,
    category: bookmark.category,
    status: bookmark.status,
    rating: bookmark.rating ?? null,
    note: bookmark.note || null,
    url: bookmark.url || null,
    image_url: bookmark.imageUrl ?? null,
    year: bookmark.year ?? null,
  };
}