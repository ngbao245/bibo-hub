// ============================================================
// QR Code — Generation utilities
// ============================================================
//
// Shared QR generation logic consumed by multiple plugins:
//   - Theme-aware foreground color (reads CSS --foreground var)
//   - HSL → Hex conversion (qrcode lib only accepts hex)
//   - SVG + DataURL output formats
//   - Lazy import of qrcode lib (keeps bundle small)
// ============================================================

import type { QrSvgOptions, QrDataUrlOptions } from './types';

/**
 * Convert CSS HSL string (space-separated Tailwind format) to hex color.
 * Input: "0 0% 83%" or "210 40% 98%" (no `hsl()` wrapper, no commas)
 * Output: "#d4d4d4" or "#f8fafc"
 */
export function hslToHex(hsl: string): string {
  const parts = hsl.replace(/%/g, '').split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return '#000000';
  const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Read the current theme's foreground color as hex.
 * Falls back to black if CSS var is missing.
 */
export function getThemeForegroundHex(): string {
  const raw =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--foreground')
      .trim() || '0 0% 0%';
  return hslToHex(raw);
}

/**
 * Generate QR code as SVG string.
 * Theme-aware by default: uses CSS --foreground for dark modules.
 *
 * @returns SVG markup string ready for dangerouslySetInnerHTML
 */
export async function generateQrSvg(
  value: string,
  options: QrSvgOptions = {},
): Promise<string> {
  const {
    width = 240,
    margin = 1,
    fgColor,
    bgColor = '#00000000',
  } = options;

  const dark = fgColor ?? getThemeForegroundHex();
  const qrcode = await import('qrcode');
  return qrcode.toString(value, {
    type: 'svg',
    margin,
    width,
    color: { dark, light: bgColor },
  });
}

/**
 * Generate QR code as data URL (PNG by default).
 * Useful for download or <img> src.
 */
export async function generateQrDataUrl(
  value: string,
  options: QrDataUrlOptions = {},
): Promise<string> {
  const {
    width = 240,
    margin = 1,
    fgColor,
    bgColor = '#00000000',
    type = 'image/png',
    quality = 0.92,
  } = options;

  const dark = fgColor ?? getThemeForegroundHex();
  const qrcode = await import('qrcode');

  const baseOpts = {
    width,
    margin,
    color: { dark, light: bgColor },
  };

  if (type === 'image/jpeg' || type === 'image/webp') {
    return qrcode.toDataURL(value, {
      ...baseOpts,
      type,
      rendererOpts: { quality },
    });
  }

  return qrcode.toDataURL(value, {
    ...baseOpts,
    type: 'image/png',
  });
}
