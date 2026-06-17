// =============================================================
// Reader credential vault — đọc từ Setting tool (mockapi /Config)
// =============================================================
//
// Cấu trúc record:
//   group:  "Readest"
//   type:   "Supabase"
//   config1..config10: FieldEntry[] đã encode (xem cryptoFields)
//
// Field cần thiết: keys "emailLogin" và "password" (e=1 = đã encrypt
// bằng AES-GCM v1 với APP_SECRET).
// =============================================================

import { fetchJson } from '@/api/client';
import { API } from '@/lib/config';
import { parseSettingList, CONFIG_KEYS } from '@/lib/setting';
import { decodeFieldSlots, decryptText, isEncrypted } from '@/lib/cryptoFields';
import { APP_SECRET } from '@/lib/appSecret';
import { useCryptoStore } from '@/stores/cryptoStore';

const VAULT_GROUP = 'Readest';
const VAULT_TYPE = 'Supabase';

export interface ReaderCreds {
  email: string;
  password: string;
}

export class VaultError extends Error {
  code:
    | 'fetch_failed'
    | 'no_record'
    | 'no_fields'
    | 'decrypt_failed'
    | 'empty_value';
  constructor(code: VaultError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Trả về (email, password) đã decrypt. Throw VaultError nếu lỗi.
 *
 * Thử passphrase theo thứ tự:
 *   1. `passphrase` truyền vào (user paste qua PassphrasePrompt)
 *   2. APP_SECRET (mặc định project)
 *   3. localStorage đã persist (lần trước user enter đúng)
 *   4. cryptoStore session (user vừa unlock Crypto modal)
 */
export async function loadReaderCreds(passphrase?: string): Promise<ReaderCreds> {
  const sessionKey = useCryptoStore.getState().passphrase;
  const persistedKey = readPersistedKey();
  const candidates = uniqStrings([
    passphrase,
    APP_SECRET,
    persistedKey,
    sessionKey,
  ]);
  if (candidates.length === 0) {
    throw new VaultError('decrypt_failed', 'No passphrase available');
  }

  let list;
  try {
    list = parseSettingList(await fetchJson<unknown>(API.CONFIGS));
  } catch (err) {
    throw new VaultError(
      'fetch_failed',
      `Cannot fetch Setting records: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }

  const record = list.find(
    (s) => s.group.trim().toLowerCase() === VAULT_GROUP.toLowerCase()
      && s.type.trim().toLowerCase() === VAULT_TYPE.toLowerCase(),
  );
  if (!record) {
    throw new VaultError(
      'no_record',
      `No Setting record with group="${VAULT_GROUP}" type="${VAULT_TYPE}"`,
    );
  }

  const entries = CONFIG_KEYS.flatMap((k) => decodeFieldSlots(record[k] ?? '', k));

  const find = (name: string) =>
    entries.find((e) => e.k.toLowerCase() === name.toLowerCase());
  const emailEntry = find('emailLogin') ?? find('email');
  const pwdEntry = find('password');
  if (!emailEntry || !pwdEntry) {
    throw new VaultError(
      'no_fields',
      'Vault thiếu field "emailLogin" hoặc "password"',
    );
  }

  let email: string | null = null;
  let password: string | null = null;
  let lastErr: unknown = null;

  for (const key of candidates) {
    try {
      email = emailEntry.e === 1 || isEncrypted(emailEntry.v)
        ? await decryptText(emailEntry.v, key)
        : emailEntry.v;
      password = pwdEntry.e === 1 || isEncrypted(pwdEntry.v)
        ? await decryptText(pwdEntry.v, key)
        : pwdEntry.v;
      break;
    } catch (err) {
      lastErr = err;
      email = null;
      password = null;
    }
  }

  if (email === null || password === null) {
    throw new VaultError(
      'decrypt_failed',
      `Decrypt failed with ${candidates.length} passphrase(s). Last error: ${lastErr instanceof Error ? lastErr.message : 'unknown'}`,
    );
  }
  if (!email || !password) {
    throw new VaultError('empty_value', 'Decrypted email/password is empty');
  }
  return { email, password };
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

// =============================================================
// Persistent passphrase — sau khi user enter đúng 1 lần, lưu vô
// localStorage để mọi lần sau auto-login luôn (xuyên session, xuyên tab,
// xuyên restart browser).
// =============================================================

const PERSIST_KEY = 'reader_vault_passphrase';

export function persistKey(passphrase: string) {
  try {
    if (passphrase) localStorage.setItem(PERSIST_KEY, passphrase);
    else localStorage.removeItem(PERSIST_KEY);
  } catch {
    // ignore quota / private mode
  }
}

function readPersistedKey(): string {
  try {
    return localStorage.getItem(PERSIST_KEY) ?? '';
  } catch {
    return '';
  }
}