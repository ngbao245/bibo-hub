import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCachedConfig } from './vault';

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Try cache first for instant session restore
const cachedConfig = getCachedConfig();
const url = envUrl || cachedConfig?.url || 'http://invalid';
const anonKey = envAnonKey || cachedConfig?.anonKey || 'invalid';

if (cachedConfig) {
  // eslint-disable-next-line no-console
  console.log('[reader-supabase] ✅ Using cached config for instant session restore');
} else if (!envUrl || !envAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[reader-supabase] No cache or env vars — will load config from vault at runtime',
  );
}

// Single Supabase client shared across reader code. Auth session is persisted
// in localStorage by default — user logs in once and stays signed in.
let client: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Track current config for helpers
let currentUrl = url;
let currentAnonKey = anonKey;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(client, prop);
  },
});

/**
 * Re-initialize Supabase client với URL và anon key từ vault.
 * Gọi 1 lần sau khi load config từ Setting tool.
 * 
 * Preserve existing session nếu có.
 */
export async function reinitializeSupabase(newUrl: string, newAnonKey: string) {
  if (!newUrl || !newAnonKey) {
    throw new Error('[reader-supabase] Cannot reinitialize with empty URL or anon key');
  }

  // Check if already initialized with same config
  if (currentUrl === newUrl && currentAnonKey === newAnonKey) {
    // eslint-disable-next-line no-console
    console.log('[reader-supabase] Already initialized with correct config, skipping');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[reader-supabase] 🔄 Reinitializing client with new config');

  // Get existing session before replacing client
  const { data: oldSessionData } = await client.auth.getSession();
  const oldSession = oldSessionData.session;

  // Update tracking vars
  currentUrl = newUrl;
  currentAnonKey = newAnonKey;

  // Create new client
  client = createClient(newUrl, newAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  // Restore session if exists (important for re-init case)
  if (oldSession) {
    // eslint-disable-next-line no-console
    console.log('[reader-supabase] 🔐 Restoring previous session to new client');
    await client.auth.setSession({
      access_token: oldSession.access_token,
      refresh_token: oldSession.refresh_token,
    });
  }
}

/**
 * Get current Supabase URL (for direct REST calls like upload progress)
 */
export function getSupabaseUrl(): string {
  return currentUrl;
}

/**
 * Get current anon key (for direct REST calls like upload progress)
 */
export function getSupabaseAnonKey(): string {
  return currentAnonKey;
}

export const BUCKET = (import.meta.env.VITE_SUPABASE_BUCKET as string) || 'books';