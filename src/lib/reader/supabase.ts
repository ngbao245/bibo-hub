import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[reader] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local',
  );
}

// Single Supabase client shared across reader code. Auth session is persisted
// in localStorage by default — user logs in once and stays signed in.
export const supabase = createClient(url ?? 'http://invalid', anonKey ?? 'invalid', {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const BUCKET = (import.meta.env.VITE_SUPABASE_BUCKET as string) || 'books';