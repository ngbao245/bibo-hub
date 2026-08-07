// ============================================================
// PDF Studio — Blank page generator
// ============================================================
// Tạo 1 trang PDF trắng A4 portrait + canvas thumbnail matching ratio.
// Dùng cho Merge "Trang trắng" toolbar action.
// ============================================================

/** A4 point dimensions (1pt = 1/72 inch) */
export const A4_WIDTH_PT = 595;
export const A4_HEIGHT_PT = 842;

/**
 * Tạo 1 file PDF chỉ có 1 trang trắng A4 portrait.
 */
export async function createBlankPagePdf(): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/**
 * Canvas thumbnail trắng dimensions match A4 ratio.
 * @param width canvas pixel width; height auto-compute theo A4 ratio.
 */
export function renderBlankThumbnail(width: number): HTMLCanvasElement {
  const ratio = A4_HEIGHT_PT / A4_WIDTH_PT;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(width * ratio);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Nhẹ nhàng thêm 1px border xám để phân biệt trang trắng với background card
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  }
  return canvas;
}
