// ============================================================
// themeApi ΓÇö Read/write user theme preferences from Supabase
// ============================================================
//
// Pattern: Optimistic Update + Debounced Background Sync
//
// 1. UI updates INSTANTLY via Zustand store (optimistic)
// 2. Save to Supabase is DEBOUNCED ΓÇö user can spam clicks,
//    only 1 request fires after 800ms idle.
// 3. On mount: fetch from DB ΓåÆ hydrate store.
// 4. On error: rollback store to last known DB state.
// ============================================================

import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { authClient } from '@/lib/core-sdk';
import { DEFAULT_THEME_SETTINGS } from './constants';
import { useThemeStore } from './store';
import type { ThemeSettings } from './types';

const QUERY_KEY = ['user_theme'] as const;
const SETTINGS_KEY = 'user_theme';
const DEBOUNCE_MS = 800;

async function fetchThemeSettings(): Promise<ThemeSettings> {
  const { data, error } = await authClient
    .from('app_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();

  if (error || !data) return DEFAULT_THEME_SETTINGS;

  const value = data.value as Partial<ThemeSettings> | null;
  if (!value || typeof value !== 'object') return DEFAULT_THEME_SETTINGS;

  return {
    theme: value.theme ?? DEFAULT_THEME_SETTINGS.theme,
    is3d: value.is3d ?? DEFAULT_THEME_SETTINGS.is3d,
    isRounded: value.isRounded ?? DEFAULT_THEME_SETTINGS.isRounded,
    isRetro: value.isRetro ?? DEFAULT_THEME_SETTINGS.isRetro,
    isPill: value.isPill ?? DEFAULT_THEME_SETTINGS.isPill,
  };
}

async function saveThemeSettings(settings: ThemeSettings): Promise<void> {
  const { error } = await authClient
    .from('app_settings')
    .upsert(
      { key: SETTINGS_KEY, value: settings, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );

  if (error) throw new Error(error.message);
}

/** Fetch theme on mount ΓåÆ hydrate store. Use in App root. */
export function useThemeHydration() {
  const { data, isSuccess } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchThemeSettings,
    staleTime: 5 * 60_000,
  });

  const hydrate = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    if (isSuccess && data) {
      hydrate(data);
    }
  }, [isSuccess, data, hydrate]);
}

/**
 * Debounced save hook.
 * UI updates store instantly (optimistic). After 800ms idle,
 * persists current store state to Supabase in a single request.
 * Spam-safe: resets timer on each call, only last state is saved.
 */
export function useSaveTheme() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<ThemeSettings | null>(null);

  const save = useCallback((settings: ThemeSettings) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      if (
        lastSavedRef.current &&
        lastSavedRef.current.theme === settings.theme &&
        lastSavedRef.current.is3d === settings.is3d &&
        lastSavedRef.current.isRounded === settings.isRounded &&
        lastSavedRef.current.isRetro === settings.isRetro &&
        lastSavedRef.current.isPill === settings.isPill
      ) {
        return;
      }

      saveThemeSettings(settings)
        .then(() => {
          lastSavedRef.current = settings;
        })
        .catch(() => {
          if (lastSavedRef.current) {
            useThemeStore.getState().hydrate(lastSavedRef.current);
          }
        });
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { save };
}