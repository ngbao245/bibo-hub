import type { ThemeId, ThemeSettings } from './types';

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  theme: 'dark',
  is3d: false,
  isRounded: false,
  isRetro: false,
  isPill: false,
};

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'cute', label: 'Cute' },
];