// Color utilities for bookmark icons + presets.
// Single source of truth for WCAG luminance + contrast text picking.

/**
 * WCAG relative luminance for a hex color (#rgb or #rrggbb).
 * Returns a value in [0..1]. Invalid input returns 0.5 (mid).
 */
export function hexLuminance(hex: string): number {
  const m = /^#?([a-f0-9]{6}|[a-f0-9]{3})$/i.exec(hex.trim());
  if (!m) return 0.5;
  let raw = m[1];
  if (raw.length === 3) raw = raw.split('').map((c) => c + c).join('');
  const int = parseInt(raw, 16);
  const rgb = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/**
 * Pick black or white text color that contrasts well with the given bg hex.
 * Returns '#0f172a' (slate-900) on light bg, '#ffffff' on dark bg.
 */
export function getContrastText(hex: string): string {
  return hexLuminance(hex) > 0.5 ? '#0f172a' : '#ffffff';
}

/**
 * Pick a contrasting label+title pair for a solid bg color.
 * Used when auto-assigning preset colors on user picks.
 */
export function contrastPair(hex: string): { label: string; title: string } {
  return hexLuminance(hex) > 0.5
    ? { label: '#1f2937', title: '#0f172a' }
    : { label: '#f9fafb', title: '#e5e7eb' };
}
