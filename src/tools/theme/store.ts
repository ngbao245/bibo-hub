// ============================================================
// themeStore — Zustand store cho theme preferences per user
// ============================================================

import { create } from 'zustand';
import { DEFAULT_THEME_SETTINGS } from './constants';
import type { ThemeId, ThemeSettings } from './types';

interface ThemeState extends ThemeSettings {
  /** True khi đã hydrate từ Supabase (hoặc default). */
  hydrated: boolean;
  setTheme: (theme: ThemeId) => void;
  setIs3d: (v: boolean) => void;
  setIsRounded: (v: boolean) => void;
  setIsRetro: (v: boolean) => void;
  setIsPill: (v: boolean) => void;
  /** Hydrate toàn bộ settings (gọi khi fetch xong từ Supabase). */
  hydrate: (settings: Partial<ThemeSettings>) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  ...DEFAULT_THEME_SETTINGS,
  hydrated: false,
  setTheme: (theme) => set({ theme }),
  setIs3d: (is3d) => set({ is3d }),
  setIsRounded: (isRounded) => set({ isRounded }),
  setIsRetro: (isRetro) => set({ isRetro }),
  setIsPill: (isPill) => set({ isPill }),
  hydrate: (settings) =>
    set({
      ...DEFAULT_THEME_SETTINGS,
      ...settings,
      hydrated: true,
    }),
}));