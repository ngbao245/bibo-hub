// ============================================================
// RAG vault — đọc tokens từ service registry (fallback app_settings)
// ============================================================
//
// Refactored: dùng serviceExecutor để resolve credentials từ pool.
// Fallback legacy app_settings khi VITE_LEGACY_SETTINGS_FALLBACK=true
// và service registry chưa có data.
//
// Backward-compat signature: `loadRagTokens(passphrase?)` giữ nguyên,
// param `passphrase` bị ignore.
// ============================================================

import { authClient } from '@/lib/authClient';
import type { CredentialWithSecret } from '@/lib/service-registry/types';

import {
  EMPTY_RAG_TOKENS,
  RagVaultError,
  type RagTokens,
} from './types';

// Legacy keys (used by legacy-fallback.ts internally)
const KEY = 'gemini_credit_pool';
const LEGACY_KEY = 'rag_tokens';

interface RagTokensRow {
  keys?: unknown;
}

/**
 * Load RAG tokens — attempts service registry first, falls back to app_settings.
 *
 * Returns RagTokens with `geminiApiKeys` array. Empty if not configured.
 */
export async function loadRagTokens(_passphrase?: string): Promise<RagTokens> {
  // Try service registry approach: load all credentials for rag/ai.generate
  try {
    const credentials = await loadCredentialsFromRegistry();
    if (credentials.length > 0) {
      const geminiApiKeys = credentials
        .map((c) => {
          const key = c.secret_data_json?.apiKey;
          return typeof key === 'string' ? key.trim() : '';
        })
        .filter((v) => v.length > 0);

      if (geminiApiKeys.length > 0) {
        return { geminiApiKeys };
      }
    }
  } catch {
    // Fall through to legacy
  }

  // Legacy fallback: read directly from app_settings
  return loadFromAppSettings();
}

/**
 * Load credentials from service registry tables directly (not via executor callback pattern).
 * This is a read-only approach since RAG vault just needs the API keys list.
 */
async function loadCredentialsFromRegistry(): Promise<CredentialWithSecret[]> {
  // Find bindings for rag + ai.generate
  const { data: bindings } = await authClient
    .from('tool_service_bindings')
    .select('profile_id')
    .eq('tool_code', 'rag')
    .eq('capability', 'ai.generate')
    .eq('enabled', true)
    .order('priority')
    .limit(1);

  if (!bindings?.length || !bindings[0].profile_id) return [];

  // Load active credentials from the profile
  const { data: credentials } = await authClient
    .from('service_credentials')
    .select('id, identifier, secret_data_json, priority, weight')
    .eq('profile_id', bindings[0].profile_id)
    .eq('status', 'active')
    .order('priority');

  return (credentials ?? []) as CredentialWithSecret[];
}

/**
 * Legacy: read directly from app_settings (pre-service-registry).
 */
async function loadFromAppSettings(): Promise<RagTokens> {
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
      if (typeof k === 'string') return k.trim();
      if (k && typeof k === 'object' && 'key' in k && typeof (k as { key: unknown }).key === 'string')
        return ((k as { key: string }).key).trim();
      return '';
    })
    .filter((v) => v.length > 0);

  return { geminiApiKeys };
}