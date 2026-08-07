import { z } from 'zod';

// ============================================================
// Bookmarks Zod schemas
// ============================================================

// Slug: [a-z0-9-]{3,30}, không bắt đầu/kết thúc bằng -
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

const RESERVED_SLUGS = ['edit', 'settings', 'api', 'admin', 'new', 'create'];

export const SlugSchema = z
  .string()
  .min(3, 'Slug tối thiểu 3 ký tự')
  .max(30, 'Slug tối đa 30 ký tự')
  .regex(SLUG_REGEX, 'Chỉ dùng a-z, 0-9, dấu gạch ngang; không bắt đầu/kết thúc bằng gạch ngang')
  .refine((s) => !RESERVED_SLUGS.includes(s), { message: 'Slug này bị reserved' });

export const SpaceNameSchema = z.string().max(40, 'Space name tối đa 40 ký tự');

// Category name: 1-60 chars, matches DB CHECK constraint `char_length(name) BETWEEN 1 AND 60`.
// Enforce at every FE entry point (create, rename, import) so DB never has to reject.
export const CATEGORY_NAME_MAX = 60;
export const CategoryNameSchema = z
  .string()
  .trim()
  .min(1, 'Tên category không được rỗng')
  .max(CATEGORY_NAME_MAX, `Tên category tối đa ${CATEGORY_NAME_MAX} ký tự`);

export const BookmarkProfileSchema = z.object({
  userId: z.string(),
  slug: SlugSchema,
  spaceName: SpaceNameSchema.default(''),
  createdAt: z.string().nullable().default(null),
  updatedAt: z.string().nullable().default(null),
});

export const BookmarkCategorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(60),
  isPublic: z.boolean().default(false),
  orderIndex: z.number().int().default(0),
  createdAt: z.string().nullable().default(null),
  updatedAt: z.string().nullable().default(null),
});

// URL: basic http/https validation
const URL_REGEX = /^https?:\/\/.+/i;

export const BookmarkUrlSchema = z
  .string()
  .min(4)
  .regex(URL_REGEX, 'URL phải bắt đầu bằng http:// hoặc https://');

export const BookmarkSchema = z.object({
  id: z.string(),
  userId: z.string(),
  categoryId: z.string(),
  url: BookmarkUrlSchema,
  title: z.string().default(''),
  note: z.string().default(''),
  faviconUrl: z.string().nullable().default(null),
  orderIndex: z.number().int().default(0),
  createdAt: z.string().nullable().default(null),
  updatedAt: z.string().nullable().default(null),
});

// ============================================================
// Helpers
// ============================================================

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Sanitize username → slug candidate. Fallback to 'user-{n}' if empty. */
export function sanitizeUsernameToSlug(username: string, fallbackId: string): string {
  const clean = username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 30);
  if (clean.length < 3) return `user-${fallbackId.slice(0, 8)}`;
  return clean;
}
