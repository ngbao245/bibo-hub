// ============================================================
// Library supabase client — resolved via core-sdk datasource
// ============================================================
//
// Client resolved from core.datasources table (code = 'library').
// Fallback: env vars VITE_SUPABASE_READER_URL / VITE_SUPABASE_READER_ANON_KEY,
// then VITE_SUPABASE_AUTH_URL / VITE_SUPABASE_AUTH_ANON_KEY (cùng project).
//
// File này giữ nguyên đường import `@/tools/library/lib/supabase` để các consumer
// (api/library/*, lib/rag/*, components/library/*) không phải đổi.
//
// Khi tách Library ra Supabase project riêng:
// 1. UPDATE datasources SET connection_json = '{"url":"...", "anon_key":"..."}' WHERE code = 'library'
// 2. App tự dùng client mới — không cần đổi code.
// ============================================================

import { authClient } from '@/lib/authClient';

// Hiện tại Library cùng project với Core → dùng authClient trực tiếp.
// Khi tách project: getClientForTool('library') sẽ trả client riêng.
// Giữ synchronous export để 8 consumers không phải refactor thành async.
export const supabase = authClient;

export const BUCKET = 'books';

/** URL dùng cho direct REST call (VD upload-with-progress). */
export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_READER_URL as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_AUTH_URL as string | undefined) ??
  '';

/** Anon key dùng cho direct REST call. */
export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_READER_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_AUTH_ANON_KEY as string | undefined) ??
  '';