import { z } from 'zod';

// ============================================================
// Bookmark Schema — workspace Supabase
// ============================================================
// Replaces Movies (was stored in notes table with type='movie'|'series').
// Now has its own table with proper columns.
// ============================================================

export const BookmarkCategorySchema = z.enum(['movie', 'series', 'manga', 'anime', 'other']);
export type BookmarkCategory = z.infer<typeof BookmarkCategorySchema>;

export const BookmarkStatusSchema = z.enum(['plan', 'watching', 'completed', 'dropped']);
export type BookmarkStatus = z.infer<typeof BookmarkStatusSchema>;

export const BookmarkSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: BookmarkCategorySchema.default('movie'),
  status: BookmarkStatusSchema.default('plan'),
  rating: z.number().nullable().default(null),
  note: z.string().default(''),
  url: z.string().default(''),
  imageUrl: z.string().nullable().default(null),
  year: z.number().nullable().default(null),
  createdAt: z.string().nullable().default(null),
  updatedAt: z.string().nullable().default(null),
});

export type Bookmark = z.infer<typeof BookmarkSchema>;

// DB Row schema (snake_case)
export const BookmarkRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  category: z.string().default('movie'),
  status: z.string().default('plan'),
  rating: z.number().nullable().default(null),
  note: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  image_url: z.string().nullable().default(null),
  year: z.number().nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
});

export type BookmarkRowZ = z.infer<typeof BookmarkRowSchema>;