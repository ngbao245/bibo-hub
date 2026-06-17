// =============================================================
// Supabase client — dynamic config from API, cached in localStorage
// =============================================================
//
// Flow:
//   1. Module load: đọc localStorage cache → init client sync (instant)
//   2. Nếu cache miss: client dùng placeholder, `initSupabaseConfig()`
//      sẽ fetch Config API → decrypt → lưu cache → re-init client
//   3. Lần sau: localStorage hit → init sync, zero delay
//
// Consumer import { supabase, BUCKET } bình thường, không cần async.
// =============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetchJson } from '@/api/client';
import { API } from '@/lib/config';
import { parseSettingList, CONFIG_KEYS } from '@/lib/setting';
import { decodeFieldSlots, decryptText, isEncrypted } from '@/lib/cryptoFields';
import { APP_SECRET } from '@/lib/appSecret';
import { useCryptoStore } from '@/stores/cryptoStore';

// ============================================================
// localStorage cache
// ============================================================

const CACHE_KEY = 'reader_sb_config';

interface SbConfig {
  url: string;
  anonKey: string;
  bucket: string;
}

function readCache(): SbConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Partial<SbConfig>;
    if (obj.url && obj.anonKey && obj.bucket) return obj as SbConfig;
    return null;
  } catch {
    return null;
  }
}

function writeCache(config: SbConfig) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(config));
  } catch {
    // ignore quota / private mode
  }
}

// ============================================================
// Init client
// ============================================================

const cached = readCache();

// Fallback: env var (dev) hoặc placeholder (sẽ fail gracefully)
const fallbackUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const fallbackKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
const fallbackBucket = (import.meta.env.VITE_SUPABASE_BUCKET as string) || 'books';

const initialUrl = cached?.url || fallbackUrl || 'http://noop';
const initialKey = cached?.anonKey || fallbackKey || 'noop';
const initialBucket = cached?.bucket || fallbackBucket;

function makeClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

/** Supabase client — consumer import bình thường. Sẽ được re-assign
 * sau `initSupabaseConfig()` nếu config thay đổi. */
// eslint-disable-next-line import/no-mutable-exports
export let supabase: SupabaseClient = makeClient(initialUrl, initialKey);

/** Storage bucket name. */
// eslint-disable-next-line import/no-mutable-exports
export let BUCKET: string = initialBucket;

/** Raw URL — cần cho XHR upload (bypass SDK). */
// eslint-disable-next-line import/no-mutable-exports
export let SUPABASE_URL: string = initialUrl;

/** Anon key — cần cho XHR upload header. */
// eslint-disable-next-line import/no-mutable-exports
export let SUPABASE_ANON_KEY: string = initialKey;

// ============================================================
// Dynamic init — fetch từ Config API, decrypt, cache, re-init
// ============================================================

let initPromise: Promise<void> | null = null;

/**
 * Fetch Supabase config từ Config API (record Readest/Supabase),
 * decrypt, lưu localStorage, re-init client.
 *
 * Gọi 1 lần khi reader route mount. Nếu đã cache thì resolve instant.
 * Nhiều caller gọi đồng thời chỉ fetch 1 lần (dedup via promise).
 */
export function initSupabaseConfig(): Promise<void> {
  // Đã có cache → không cần fetch
  if (readCache()) return Promise.resolve();
  // Dedup concurrent calls
  if (initPromise) return initPromise;
  initPromise = doInit();
  return initPromise;
}

async function doInit(): Promise<void> {
  try {
    const config = await fetchSupabaseConfig();
    writeCache(config);
    supabase = makeClient(config.url, config.anonKey);
    BUCKET = config.bucket;
    SUPABASE_URL = config.url;
    SUPABASE_ANON_KEY = config.anonKey;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[reader] Failed to fetch Supabase config from API:', err);
    // Giữ client hiện tại (env fallback hoặc placeholder)
  } finally {
    initPromise = null;
  }
}

async function fetchSupabaseConfig(): Promise<SbConfig> {
  const sessionKey = useCryptoStore.getState().passphrase;
  const persistedKey = readPersistedPassphrase();
  const candidates = uniqStrings([APP_SECRET, persistedKey, sessionKey]);

  if (candidates.length === 0) {
    throw new Error('No passphrase available to decrypt Supabase config');
  }

  const list = parseSettingList(await fetchJson<unknown>(API.CONFIGS));
  const record = list.find(
    (s) =>
      s.group.trim().toLowerCase() === 'readest' &&
      s.type.trim().toLowerCase() === 'supabase',
  );
  if (!record) {
    throw new Error('No Setting record with group="Readest" type="Supabase"');
  }

  const entries = CONFIG_KEYS.flatMap((k) => decodeFieldSlots(record[k] ?? '', k));
  const find = (name: string) =>
    entries.find((e) => e.k.toLowerCase() === name.toLowerCase());

  const urlEntry = find('supabaseurl') ?? find('supabaseURL');
  const keyEntry = find('supabaseanonymouskey') ?? find('supabaseAnonymousKey');
  const bucketEntry = find('supabasebucket') ?? find('supabaseBucket');

  if (!urlEntry || !keyEntry) {
    throw new Error('Config record missing supabaseURL or supabaseAnonymousKey fields');
  }

  let url: string | null = null;
  let anonKey: string | null = null;
  let bucket: string = 'books';

  for (const key of candidates) {
    try {
      url =
        urlEntry.e === 1 || isEncrypted(urlEntry.v)
          ? await decryptText(urlEntry.v, key)
          : urlEntry.v;
      anonKey =
        keyEntry.e === 1 || isEncrypted(keyEntry.v)
          ? await decryptText(keyEntry.v, key)
          : keyEntry.v;
      if (bucketEntry) {
        bucket =
          bucketEntry.e === 1 || isEncrypted(bucketEntry.v)
            ? await decryptText(bucketEntry.v, key)
            : bucketEntry.v;
      }
      break;
    } catch {
      url = null;
      anonKey = null;
    }
  }

  if (!url || !anonKey) {
    throw new Error('Failed to decrypt Supabase config with available passphrases');
  }

  return { url, anonKey, bucket };
}

// ============================================================
// Helpers
// ============================================================

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

const PERSIST_KEY = 'reader_vault_passphrase';

function readPersistedPassphrase(): string {
  try {
    return localStorage.getItem(PERSIST_KEY) ?? '';
  } catch {
    return '';
  }
}