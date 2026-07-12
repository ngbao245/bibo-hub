// ============================================================
// Library supabase client — re-export authClient (Project A)
// ============================================================
//
// Sau migration Library → Project A (spec library-migrate-to-project-a),
// tất cả bảng books/highlights/reading_progress + storage bucket `books`
// đều ở Project A. Library dùng CÙNG client với auth/profile/app_settings —
// không còn 2-project pattern (Project B `hubibo` đã snapshot rollback).
//
// File này giữ nguyên đường import `@/lib/library/supabase` để các consumer
// (api/library/*, lib/rag/*, components/library/*) không phải đổi.
// ============================================================

import { authClient } from '@/lib/authClient';

export const supabase = authClient;

export const BUCKET = 'books';

/** URL Project A (dùng cho direct REST call, VD upload-with-progress). */
export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_AUTH_URL as string | undefined) ?? '';

/** Anon key Project A. */
export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_AUTH_ANON_KEY as string | undefined) ?? '';