// ============================================================
// themeStore — Zustand store cho theme preferences per user
// ============================================================
//
// State: theme (dark/light/cute), is3d, isRounded
// Persist: Supabase app_settings key 'user_theme'
// Consumer: App root (data attributes), DesignSystem (preview), avatar dropdown
// ============================================================

import { create } from 'zustand';

export type ThemeId = 'dark' | 'light' | 'cute';

export interface ThemeSettings {
  theme: ThemeId;
  is3d: boolean;
  isRounded: boolean;
}

interface ThemeState extends ThemeSettings {
  /** True khi đã hydrate từ Supabase (hoặc default). */
  hydrated: boolean;
  setTheme: (theme: ThemeId) => void;
  setIs3d: (v: boolean) => void;
  setIsRounded: (v: boolean) => void;
  /** Hydrate toàn bộ settings (gọi khi fetch xong từ Supabase). */
  hydrate: (settings: Partial<ThemeSettings>) => void;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  theme: 'dark',
  is3d: false,
  isRounded: false,
};

export const useThemeStore = create<ThemeState>((set) => ({
  ...DEFAULT_THEME_SETTINGS,
  hydrated: false,
  setTheme: (theme) => set({ theme }),
  setIs3d: (is3d) => set({ is3d }),
  setIsRounded: (isRounded) => set({ isRounded }),
  hydrate: (settings) =>
    set({
      ...DEFAULT_THEME_SETTINGS,
      ...settings,
      hydrated: true,
    }),
}));