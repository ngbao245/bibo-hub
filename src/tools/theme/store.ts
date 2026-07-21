// ============================================================
// themeStore ΓÇö Zustand store cho theme preferences per user
// ============================================================

import { create } from 'zustand';
import { DEFAULT_THEME_SETTINGS } from './constants';
import type { ThemeId, ThemeSettings } from './types';

interface ThemeState extends ThemeSettings {
  /** True khi ─æ├ú hydrate tß╗½ Supabase (hoß║╖c default). */
  hydrated: boolean;
  setTheme: (theme: ThemeId) => void;
  setIs3d: (v: boolean) => void;
  setIsRounded: (v: boolean) => void;
  setIsRetro: (v: boolean) => void;
  setIsPill: (v: boolean) => void;
  /** Hydrate to├án bß╗Ö settings (gß╗ìi khi fetch xong tß╗½ Supabase). */
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