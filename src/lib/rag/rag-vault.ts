// ============================================================
// RAG vault — đọc tokens từ Supabase app_settings.gemini_credit_pool
// ============================================================
//
// Refactored: bỏ APP_SECRET / cryptoStore / cryptoFields.
// Data nay ở Supabase (project auth mới), plaintext, RLS chặn access
// theo profile.allowed_tools.
//
// Backward-compat signature: `loadRagTokens(passphrase?)` giữ nguyên,
// param `passphrase` bị ignore.
// ============================================================

import { authClient } from '@/lib/authClient';

import {
  EMPTY_RAG_TOKENS,
  RagVaultError,
  type RagTokens,
} from './types';

// Credit pool key dùng chung — RAG + Agency AI generate.
// Trước 2026-07-12 tên là 'rag_tokens' — migration rename qua
// gemini_credit_pool. Nếu deploy chưa chạy migration, fallback đọc key cũ.
const KEY = 'gemini_credit_pool';
const LEGACY_KEY = 'rag_tokens';

interface RagTokensRow {
  keys?: unknown;
}

/**
 * Load RAG tokens từ app_settings Supabase.
 *
 * Throw RagVaultError nếu:
 *   - Query fail (network, RLS deny với error rõ ràng)
 *
 * Trả về RagTokens với `geminiApiKeys` non-empty array. Rỗng nếu chưa setup.
 * RLS deny (permission_denied) → trả empty tokens (không throw), UI xử lý "chưa có quyền".
 */
export async function loadRagTokens(_passphrase?: string): Promise<RagTokens> {
  // Try key mới trước, fallback legacy key nếu migration chưa chạy.
  let { data, error } = await authClient
    .from('app_settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle();

  if ((!data || !data.value) && !error) {
    const legacy = await authClient
      .from('app_settings')
      .select('value')
      .eq('key', LEGACY_KEY)
      .maybeSingle();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) {
    // RLS deny → trả empty, UI xử theo status needs_setup
    if (error.code === '42501' || error.code === 'PGRST116') {
      return { ...EMPTY_RAG_TOKENS };
    }
    throw new RagVaultError(
      'fetch_failed',
      `Failed to load gemini_credit_pool: ${error.message}`,
    );
  }

  if (!data || !data.value) {
    return { ...EMPTY_RAG_TOKENS };
  }

  const row = data.value as RagTokensRow;
  if (!Array.isArray(row.keys)) {
    return { ...EMPTY_RAG_TOKENS };
  }

  const geminiApiKeys = row.keys
    .map((k: unknown) => {
      if (typeof k === 'string') return k.trim(); // backward-compat old format
      if (k && typeof k === 'object' && 'key' in k && typeof (k as { key: unknown }).key === 'string')
        return ((k as { key: string }).key).trim();
      return '';
    })
    .filter((v) => v.length > 0);

  return { geminiApiKeys };
}