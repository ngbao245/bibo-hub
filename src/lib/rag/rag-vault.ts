// ============================================================
// RAG vault — đọc record `group=RAG, type=SettingInfor` từ
// MockAPI `/Config`. Tokens encrypted bằng AES-GCM (cryptoFields).
//
// Pattern giống `src/lib/reader/vault.ts`:
//   - Chained candidate passphrases (param > APP_SECRET > persisted > session).
//   - Mỗi field có thể encrypted (e=1) hoặc plain (e=0), tự detect.
//
// Khi record không tồn tại → throw RagVaultError('no_record').
// App boot sẽ catch lỗi này và set status='needs_setup'.
// ============================================================

import { fetchJson } from '@/api/client';
import { API } from '@/lib/config';
import { parseSettingList, CONFIG_KEYS } from '@/lib/setting';
import { decodeFieldSlots, decryptText, isEncrypted } from '@/lib/cryptoFields';
import { APP_SECRET } from '@/lib/appSecret';
import { useCryptoStore } from '@/stores/cryptoStore';

import {
  EMPTY_RAG_TOKENS,
  RagVaultError,
  type RagTokens,
} from './types';

const RAG_GROUP = 'RAG';
const TOKENS_TYPE = 'SettingInfor';

/** Persistent passphrase chia sẻ với Reader (cùng key localStorage). */
const PERSIST_KEY = 'reader_vault_passphrase';

function readPersistedKey(): string {
  try {
    return localStorage.getItem(PERSIST_KEY) ?? '';
  } catch {
    return '';
  }
}

function uniqStrings(arr: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Load RAG tokens từ vault.
 *
 * Throw RagVaultError nếu:
 *   - fetch /Config fail
 *   - không tìm thấy record group=RAG, type=SettingInfor
 *   - tất cả candidate passphrase đều decrypt fail
 *
 * Trả về RagTokens với `geminiApiKeys` là array các key non-empty (có thể rỗng nếu user chưa setup).
 */
export async function loadRagTokens(passphrase?: string): Promise<RagTokens> {
  const sessionKey = useCryptoStore.getState().passphrase;
  const persistedKey = readPersistedKey();
  const candidates = uniqStrings([
    passphrase,
    APP_SECRET,
    persistedKey,
    sessionKey,
  ]);

  if (candidates.length === 0) {
    throw new RagVaultError('decrypt_failed', 'No passphrase available');
  }

  let list;
  try {
    list = parseSettingList(await fetchJson<unknown>(API.CONFIGS));
  } catch (err) {
    throw new RagVaultError(
      'fetch_failed',
      `Cannot fetch Setting records: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }

  const record = list.find(
    (s) =>
      s.group.trim().toLowerCase() === RAG_GROUP.toLowerCase() &&
      s.type.trim().toLowerCase() === TOKENS_TYPE.toLowerCase(),
  );

  if (!record) {
    throw new RagVaultError(
      'no_record',
      `No Setting record with group="${RAG_GROUP}" type="${TOKENS_TYPE}"`,
    );
  }

  // Flatten tất cả entries từ config1..config10
  const entries = CONFIG_KEYS.flatMap((k) => decodeFieldSlots(record[k] ?? '', k));

  // Filter entries có key match pattern geminiApiKeyN (N = 1, 2, 3, ...)
  // Backward compat: format cũ dùng 'geminiApiKey1', 'geminiApiKey2', ...
  // Format mới cũng cùng convention → không cần migrate data.
  // Bỏ qua entry `groqApiKey` (feature đã bỏ).
  const geminiEntries = entries
    .filter((e) => /^geminiApiKey\d+$/i.test(e.k))
    .sort((a, b) => {
      const nA = parseInt(a.k.replace(/^geminiApiKey/i, ''), 10) || 0;
      const nB = parseInt(b.k.replace(/^geminiApiKey/i, ''), 10) || 0;
      return nA - nB;
    });

  // Nếu không có entry nào → tokens rỗng
  if (geminiEntries.length === 0) {
    return { ...EMPTY_RAG_TOKENS };
  }

  // Tìm passphrase đúng bằng cách thử decrypt entry đầu tiên có encrypted
  let workingKey: string | null = null;
  let lastErr: unknown = null;
  const firstEncrypted = geminiEntries.find(
    (e) => e.e === 1 || isEncrypted(e.v),
  );

  if (firstEncrypted) {
    for (const candidate of candidates) {
      try {
        await decryptText(firstEncrypted.v, candidate);
        workingKey = candidate;
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (workingKey === null) {
      throw new RagVaultError(
        'decrypt_failed',
        `Decrypt failed with ${candidates.length} passphrase(s). Last: ${
          lastErr instanceof Error ? lastErr.message : 'unknown'
        }`,
      );
    }
  }

  // Decrypt tất cả entry với workingKey, tạo array (giữ non-empty)
  const geminiApiKeys: string[] = [];
  for (const entry of geminiEntries) {
    let plaintext = '';
    if (entry.e === 1 || isEncrypted(entry.v)) {
      if (workingKey === null) continue;
      try {
        plaintext = await decryptText(entry.v, workingKey);
      } catch {
        // Entry encrypt bằng key khác → skip
        continue;
      }
    } else {
      plaintext = entry.v ?? '';
    }
    if (plaintext.trim().length > 0) {
      geminiApiKeys.push(plaintext);
    }
  }

  return { geminiApiKeys };
}