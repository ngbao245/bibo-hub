// ============================================================
// PDF Studio — Watermark canvas renderer
// ============================================================
// Pure function: vẽ text watermark lên canvas.
// Supports single position (top/center/bottom) + tile mode (grid repeat).
// Dùng font hệ thống → full Unicode.
// ============================================================

import type { WatermarkPdfOptions } from './operations';

export interface WatermarkRenderOptions extends WatermarkPdfOptions {
  /** Tile mode: repeat watermark across entire page in grid pattern */
  tile?: boolean;
  /** Vertical gap between tile rows (px). Default 40. */
  tileGap?: number;
  /** Horizontal gap between tile columns (px). Default 40. */
  tileGapX?: number;
  /** Font size in px (overrides auto-calc if provided) */
  fontSize?: number;
  /** Font family */
  fontFamily?: string;
}

/**
 * Vẽ text watermark lên canvas context.
 */
export function renderWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  options: WatermarkRenderOptions,
  pageWidth: number,
  pageHeight: number,
): void {
  const text = options.text.trim();
  if (!text) return;

  ctx.save();

  // Font size: user-specified or auto-scale (min 24, max 96)
  const fontSize = options.fontSize ?? Math.min(96, Math.max(24, pageWidth * 0.06));
  const family = options.fontFamily ?? 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  ctx.font = `600 ${fontSize}px ${family}`;
  ctx.fillStyle = `rgba(128, 128, 128, ${options.opacity / 100})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (options.tile) {
    // Tile mode: staggered grid repeat across page.
    // Khi rotation lớn (45°), naive grid tạo gap nhìn xa vì mắt đo theo
    // đường chéo. Fix: dùng staggered rows (hàng chẵn offset nửa stepX)
    // + compensate stepX theo cos(rotation) để density đều hơn.
    const gapY = options.tileGap ?? 80;
    const gapX = options.tileGapX ?? 80;
    const textWidth = ctx.measureText(text).width;
    const rad = (options.rotation * Math.PI) / 180;

    // Compensate: khi rotation ≠ 0, text chiếm bounding box khác.
    // Giảm step theo direction thực tế để chữ ken sát hơn.
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));
    // Effective width/height of rotated text bounding box
    const rotatedW = textWidth * absCos + fontSize * absSin;
    const rotatedH = textWidth * absSin + fontSize * absCos;

    const stepX = rotatedW + gapX;
    const stepY = rotatedH + gapY;

    // Extend render area beyond page to cover corners khi rotated text peek in
    const overflowX = stepX;
    const overflowY = stepY;

    for (let row = 0, y = -overflowY; y < pageHeight + overflowY; y += stepY, row++) {
      // Stagger: hàng lẻ offset nửa stepX → pattern đều mắt hơn
      const offsetX = row % 2 === 0 ? 0 : stepX / 2;
      for (let x = -overflowX + offsetX; x < pageWidth + overflowX; x += stepX) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rad);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
  } else {
    // Single position mode
    let cy: number;
    switch (options.position) {
      case 'top':
        cy = fontSize * 1.5;
        break;
      case 'bottom':
        cy = pageHeight - fontSize * 1.5;
        break;
      default:
        cy = pageHeight / 2;
    }

    ctx.translate(pageWidth / 2, cy);
    ctx.rotate((options.rotation * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
  }

  ctx.restore();
}
