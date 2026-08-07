// ============================================================
// QR Code — Types
// ============================================================

export interface QrSvgOptions {
  /** Width in pixels (default 240) */
  width?: number;
  /** Margin in QR modules (default 1) */
  margin?: number;
  /** Override foreground color (hex). If not set, reads from theme. */
  fgColor?: string;
  /** Background color (hex with alpha). Default transparent. */
  bgColor?: string;
}

export interface QrDataUrlOptions extends QrSvgOptions {
  /** Image format for data URL (default 'image/png') */
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  /** Quality 0-1 for jpeg/webp (default 0.92) */
  quality?: number;
}
