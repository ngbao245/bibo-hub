// ============================================================
// QR Code — Public exports
// ============================================================
//
// Usage:
//   import { generateQrSvg, generateQrDataUrl } from '@/lib/qr';
//
//   // Dynamic import (smaller bundle, recommended for lazy pages):
//   const { generateQrSvg } = await import('@/lib/qr');
// ============================================================

export type { QrSvgOptions, QrDataUrlOptions } from './types';
export { hslToHex, getThemeForegroundHex, generateQrSvg, generateQrDataUrl } from './generate';
