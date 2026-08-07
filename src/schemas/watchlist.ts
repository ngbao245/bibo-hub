import { z } from 'zod';

// ============================================================
// Watchlist Schema — workspace Supabase
// ============================================================
// Renamed from Bookmark (formerly Movies). Media tracker for
// movies / series / manga / anime.
//
// DB table `watchlist` (renamed from `bookmarks` in Task 0.2 migration).
// ============================================================

export const WatchlistCategorySchema = z.enum(['movie', 'series', 'manga', 'anime', 'other']);
export type WatchlistCategory = z.infer<typeof WatchlistCategorySchema>;

export const WatchlistStatusSchema = z.enum(['plan', 'watching', 'completed', 'dropped']);
export type WatchlistStatus = z.infer<typeof WatchlistStatusSchema>;

export const WatchlistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: WatchlistCategorySchema.default('movie'),
  status: WatchlistStatusSchema.default('plan'),
  rating: z.number().nullable().default(null),
  note: z.string().default(''),
  url: z.string().default(''),
  imageUrl: z.string().nullable().default(null),
  year: z.number().nullable().default(null),
  createdAt: z.string().nullable().default(null),
  updatedAt: z.string().nullable().default(null),
});

export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

// DB Row schema (snake_case)
export const WatchlistRowSchema = z.object({
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

export type WatchlistRowZ = z.infer<typeof WatchlistRowSchema>;
