// ============================================================
// settingsApi — CRUD app_settings Supabase
// ============================================================
//
// Well-known keys:
//   - 'gemini_credit_pool' → { keys: { name, key }[] }
//     Credit pool Gemini dùng chung — RAG search + Agency Studio AI
//     generate email. Trước đây gọi 'rag_tokens' nhưng scope đã mở rộng.
//   - 'p2p_config'      → { ... } (schema tùy P2P tool)
//   - 'compress_config' → { keys: { name, public_key, secret_key }[], compression_level }
//                         (iLovePDF Developer API config)
//   - 'drive_backup_config' → { name, client_id, client_secret, refresh_token, folder_id }
//                              (OAuth2 personal account for Drive backup)
//
// (reader_config đã bỏ sau spec library-migrate-to-project-a — Library
// dùng chung env authClient, không còn 2-project.)
//
// RLS backend đã chặn access theo allowed_tools. Client chỉ cần
// query bình thường, error nếu không có quyền.
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';

export type SettingsKey = 'gemini_credit_pool' | 'p2p_config' | 'compress_config' | 'drive_backup_config';

export interface GeminiKeyEntry {
  name?: string;
  key: string;
}

export interface GeminiCreditPoolValue {
  keys: GeminiKeyEntry[];
}

/** @deprecated Backwards compat — use GeminiKeyEntry. */
export type RagKeyEntry = GeminiKeyEntry;
/** @deprecated Backwards compat — use GeminiCreditPoolValue. */
export type RagTokensValue = GeminiCreditPoolValue;

export interface P2PConfigValue {
  [k: string]: unknown;
}

export type CompressionLevel = 'low' | 'recommended' | 'extreme';

export interface IlovepdfKeyEntry {
  name?: string;
  public_key: string;
  /** Optional secret (dùng cho server-side JWT sign, advanced). */
  secret_key?: string;
}

export interface CompressConfigValue {
  /** Danh sách key pool. Fail-over qua từng key nếu quota hết. */
  keys: IlovepdfKeyEntry[];
  compression_level: CompressionLevel;
}

export interface DriveBackupConfigValue {
  name?: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  folder_id: string;
}

export type SettingsValueMap = {
  gemini_credit_pool: GeminiCreditPoolValue;
  p2p_config: P2PConfigValue;
  compress_config: CompressConfigValue;
  drive_backup_config: DriveBackupConfigValue;
};

async function fetchSetting<K extends SettingsKey>(
  key: K,
): Promise<SettingsValueMap[K] | null> {
  const { data, error } = await authClient
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    // RLS deny → error code 42501 (permission denied); trả null cho UI xử
    if (error.code === 'PGRST116' || error.code === '42501') return null;
    throw new Error(error.message);
  }

  if (!data) return null;
  return data.value as SettingsValueMap[K];
}

export function useSettingQuery<K extends SettingsKey>(key: K) {
  return useQuery({
    queryKey: ['appSettings', key],
    queryFn: () => fetchSetting(key),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useUpdateSettingMutation<K extends SettingsKey>(key: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: SettingsValueMap[K]) => {
      const { error } = await authClient
        .from('app_settings')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) throw new Error(error.message);
      return value;
    },
    onSuccess: (value) => {
      qc.setQueryData(['appSettings', key], value);
    },
  });
}