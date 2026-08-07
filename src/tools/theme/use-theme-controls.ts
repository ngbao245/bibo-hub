// ============================================================
// useThemeControls — SSOT logic cho mọi UI theme control
// ============================================================
// Dùng bởi cả DesignSystemV2 (chip pill) lẫn HubPro (card preview).
// Presentation khác nhau, nhưng logic (persist, toggles) chỉ 1 bản ở đây → hết drift.
// ============================================================

import { useThemeStore } from './store';
import { useSaveTheme } from './api';
import type { ThemeId } from './types';

export interface ThemeControlsApi {
  theme: ThemeId;
  is3d: boolean;
  isRounded: boolean;
  isPill: boolean;
  isRetro: boolean;
  setTheme: (t: ThemeId) => void;
  toggleLift: () => void;
  /** Toggle Subtle (rounded). Mutual exclusive với Pill — bật Subtle → tắt Pill. */
  toggleRounded: () => void;
  /** Toggle Pill. Mutual exclusive với Subtle — bật Pill → tắt Subtle. */
  togglePill: () => void;
  toggleRetro: () => void;
}

export function useThemeControls(): ThemeControlsApi {
  const theme = useThemeStore((s) => s.theme);
  const is3d = useThemeStore((s) => s.is3d);
  const isRounded = useThemeStore((s) => s.isRounded);
  const isPill = useThemeStore((s) => s.isPill);
  const isRetro = useThemeStore((s) => s.isRetro);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setIs3d = useThemeStore((s) => s.setIs3d);
  const setIsRounded = useThemeStore((s) => s.setIsRounded);
  const setIsPill = useThemeStore((s) => s.setIsPill);
  const setIsRetro = useThemeStore((s) => s.setIsRetro);
  const saveTheme = useSaveTheme();

  const persist = (patch: Partial<{
    theme: ThemeId;
    is3d: boolean;
    isRounded: boolean;
    isPill: boolean;
    isRetro: boolean;
  }>) => {
    saveTheme.save({
      theme: patch.theme ?? theme,
      is3d: patch.is3d ?? is3d,
      isRounded: patch.isRounded ?? isRounded,
      isPill: patch.isPill ?? isPill,
      isRetro: patch.isRetro ?? isRetro,
    });
  };

  return {
    theme,
    is3d,
    isRounded,
    isPill,
    isRetro,
    setTheme: (t) => {
      setTheme(t);
      persist({ theme: t });
    },
    toggleLift: () => {
      const next = !is3d;
      setIs3d(next);
      persist({ is3d: next });
    },
    toggleRounded: () => {
      const next = !isRounded;
      setIsRounded(next);
      if (next) setIsPill(false);
      persist({ isRounded: next, isPill: next ? false : isPill });
    },
    togglePill: () => {
      const next = !isPill;
      setIsPill(next);
      if (next) setIsRounded(false);
      persist({ isPill: next, isRounded: next ? false : isRounded });
    },
    toggleRetro: () => {
      const next = !isRetro;
      setIsRetro(next);
      persist({ isRetro: next });
    },
  };
}
