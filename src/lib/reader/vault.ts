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

export interface ReaderConfig {
  url: string;
  anonKey: string;
}

interface CachedConfig extends ReaderConfig {
  cachedAt: number;
}

const CONFIG_CACHE_KEY = 'reader_supabase_config_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Get cached Supabase config từ localStorage.
 * Return null nếu không có hoặc expired.
 */
export function getCachedConfig(): ReaderConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedConfig;
    if (!cached.url || !cached.anonKey || !cached.cachedAt) return null;
    // Check expiry
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CONFIG_CACHE_KEY);
      return null;
    }
    return { url: cached.url, anonKey: cached.anonKey };
  } catch {
    return null;
  }
}

/**
 * Cache Supabase config vào localStorage với timestamp.
 */
export function cacheConfig(config: ReaderConfig): void {
  try {
    const cached: CachedConfig = {
      ...config,
      cachedAt: Date.now(),
    };
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Clear cached config (khi user logout hoặc config thay đổi)
 */
export function clearCachedConfig(): void {
  try {
    localStorage.removeItem(CONFIG_CACHE_KEY);
  } catch {
    // Ignore
  }
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
 * Load Supabase config (URL và anon key) từ vault.
 * Throw VaultError nếu lỗi.
 */
export async function loadReaderConfig(passphrase?: string): Promise<ReaderConfig> {
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
  const urlEntry = find('supabaseURL') ?? find('supabaseUrl') ?? find('url');
  const keyEntry = find('supabaseAnonymousKey') ?? find('supabaseKey') ?? find('anonKey');

  if (!urlEntry || !keyEntry) {
    throw new VaultError(
      'no_fields',
      'Vault thiếu field "supabaseURL" hoặc "supabaseAnonymousKey"',
    );
  }

  let url: string | null = null;
  let anonKey: string | null = null;
  let lastErr: unknown = null;

  for (const key of candidates) {
    try {
      url = urlEntry.e === 1 || isEncrypted(urlEntry.v)
        ? await decryptText(urlEntry.v, key)
        : urlEntry.v;
      anonKey = keyEntry.e === 1 || isEncrypted(keyEntry.v)
        ? await decryptText(keyEntry.v, key)
        : keyEntry.v;
      break;
    } catch (err) {
      lastErr = err;
      url = null;
      anonKey = null;
    }
  }

  if (url === null || anonKey === null) {
    throw new VaultError(
      'decrypt_failed',
      `Decrypt failed with ${candidates.length} passphrase(s). Last error: ${lastErr instanceof Error ? lastErr.message : 'unknown'}`,
    );
  }
  if (!url || !anonKey) {
    throw new VaultError('empty_value', 'Decrypted URL/key is empty');
  }
  return { url, anonKey };
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