import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[reader-supabase] Missing env vars — will try loading from vault at runtime',
  );
}

// Single Supabase client shared across reader code. Auth session is persisted
// in localStorage by default — user logs in once and stays signed in.
let client: SupabaseClient = createClient(
  url ?? 'http://invalid',
  anonKey ?? 'invalid',
  { auth: { persistSession: true, autoRefreshToken: true } }
);

// Track current config for helpers
let currentUrl = url ?? 'http://invalid';
let currentAnonKey = anonKey ?? 'invalid';

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(client, prop);
  },
});

/**
 * Re-initialize Supabase client với URL và anon key từ vault.
 * Gọi 1 lần sau khi load config từ Setting tool.
 */
export function reinitializeSupabase(newUrl: string, newAnonKey: string) {
  if (!newUrl || !newAnonKey) {
    throw new Error('[reader-supabase] Cannot reinitialize with empty URL or anon key');
  }
  // eslint-disable-next-line no-console
  console.log('[reader-supabase] ✅ Reinitializing client with dynamic config');
  currentUrl = newUrl;
  currentAnonKey = newAnonKey;
  client = createClient(newUrl, newAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
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