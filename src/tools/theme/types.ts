export type ThemeId = 'dark' | 'light' | 'cute';

export interface ThemeSettings {
  theme: ThemeId;
  is3d: boolean;
  isRounded: boolean;
  isRetro: boolean;
  isPill: boolean;
}