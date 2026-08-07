// ============================================================
// PDF Studio Edit PDF - Export (flatten overlay into new PDF)
// ============================================================
// Text rendering: canvas -> PNG embed cho full Unicode (Vietnamese).
// pdf-lib StandardFonts WinAnsi codec không encode Đ,ă,ơ... nên bỏ
// page.drawText cho text objects, dùng canvas với system font.
//
// Arrow: draw polygon head ở end point (3 line tam giác).
// ============================================================

import type {
  EditorObject,
  TextObject,
  ShapeObject,
  SymbolObject,
  PathObject,
  TextReplacementObject,
} from './editor-objects';

export interface ExportOptions {
  originalPdf: Blob;
  workingRevision: Blob | null;
  objects: EditorObject[];
  filename: string;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
}

// Scale render canvas x2 để text sharp
const TEXT_RASTER_SCALE = 2;

// pdf-lib types dynamic (lazy import)
type PDFLib = typeof import('pdf-lib');

export async function exportPdf(options: ExportOptions): Promise<ExportResult> {
  const pdfLib = await import('pdf-lib');
  const { PDFDocument, rgb, degrees } = pdfLib;

  const source = options.workingRevision ?? options.originalPdf;
  const arrayBuffer = await source.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  for (const obj of options.objects) {
    const pageIndex = parsePageIndex(obj.pageId);
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { height: pageHeight } = page.getSize();
    const drawY = pageHeight - obj.y - obj.height;

    if (obj.type === 'text') {
      await drawTextAsImage(pdfDoc, page, obj as TextObject, pageHeight);
      continue;
    }
    if (obj.type === 'shape') {
      drawShape(page, obj as ShapeObject, drawY, rgb, degrees);
      continue;
    }
    if (obj.type === 'symbol') {
      drawSymbol(page, obj as SymbolObject, drawY, rgb);
      continue;
    }
    if (obj.type === 'path' || obj.type === 'highlight') {
      drawPath(page, obj as PathObject, drawY, pageHeight, rgb);
      continue;
    }
    if (obj.type === 'text-replacement') {
      await drawTextReplacement(pdfDoc, page, obj as TextReplacementObject, pageHeight, rgb);
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  return { blob, filename: options.filename };
}

// ─── Text via canvas → PNG (Unicode-safe) ──────────────────

async function drawTextAsImage(
  pdfDoc: import('pdf-lib').PDFDocument,
  page: import('pdf-lib').PDFPage,
  obj: TextObject,
  pageHeight: number,
) {
  if (!obj.content.trim()) return;

  const canvas = document.createElement('canvas');
  const canvasW = Math.max(1, Math.round(obj.width * TEXT_RASTER_SCALE));
  const canvasH = Math.max(1, Math.round(obj.height * TEXT_RASTER_SCALE));
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const weight = obj.fontWeight === 'bold' ? 'bold ' : '';
  const style = obj.fontStyle === 'italic' ? 'italic ' : '';
  const fontPx = obj.fontSize * TEXT_RASTER_SCALE;
  ctx.font = `${style}${weight}${fontPx}px ${obj.fontFamily}, Arial, sans-serif`;
  ctx.fillStyle = obj.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = obj.align === 'right' ? 'right' : obj.align === 'center' ? 'center' : 'left';
  const drawX = obj.align === 'right' ? canvasW - 2 : obj.align === 'center' ? canvasW / 2 : 2;

  const lines = wrapText(ctx, obj.content, canvasW - 4);
  const lineHeight = fontPx * 1.2;
  for (let i = 0; i < lines.length; i++) {
    const y = i * lineHeight;
    if (y + lineHeight > canvasH) break;
    ctx.fillText(lines[i], drawX, y);
  }

  const pngUrl = canvas.toDataURL('image/png');
  const pngBytes = base64ToUint8Array(pngUrl.split(',')[1]);
  const pngImage = await pdfDoc.embedPng(pngBytes);

  const drawY = pageHeight - obj.y - obj.height;
  page.drawImage(pngImage, {
    x: obj.x,
    y: drawY,
    width: obj.width,
    height: obj.height,
    opacity: obj.opacity / 100,
  });
}

async function drawTextReplacement(
  pdfDoc: import('pdf-lib').PDFDocument,
  page: import('pdf-lib').PDFPage,
  rep: TextReplacementObject,
  pageHeight: number,
  rgb: PDFLib['rgb'],
) {
  const [bgR, bgG, bgB] = hexToRgb(rep.backgroundColor);
  const bounds = rep.originalBounds;
  const boundsPdfY = pageHeight - bounds.y - bounds.height;
  page.drawRectangle({
    x: bounds.x,
    y: boundsPdfY,
    width: bounds.width,
    height: bounds.height,
    color: rgb(bgR, bgG, bgB),
  });
  if (!rep.content.trim()) return;
  const textObj: TextObject = {
    ...rep,
    type: 'text',
    align: 'left',
  };
  await drawTextAsImage(pdfDoc, page, textObj, pageHeight);
}

// ─── Shapes ────────────────────────────────────────────────

function drawShape(
  page: import('pdf-lib').PDFPage,
  shapeObj: ShapeObject,
  drawY: number,
  rgb: PDFLib['rgb'],
  degrees: PDFLib['degrees'],
) {
  const [sr, sg, sb] = hexToRgb(shapeObj.strokeColor);
  const [fr, fg, fb] = hexToRgb(shapeObj.fillColor);
  const hasFill = shapeObj.fillColor !== 'transparent';

  if (shapeObj.shapeKind === 'rectangle') {
    page.drawRectangle({
      x: shapeObj.x,
      y: drawY,
      width: shapeObj.width,
      height: shapeObj.height,
      borderColor: rgb(sr, sg, sb),
      borderWidth: shapeObj.strokeWidth,
      color: hasFill ? rgb(fr, fg, fb) : undefined,
      opacity: shapeObj.opacity / 100,
      rotate: degrees(shapeObj.rotation),
    });
  } else if (shapeObj.shapeKind === 'ellipse') {
    page.drawEllipse({
      x: shapeObj.x + shapeObj.width / 2,
      y: drawY + shapeObj.height / 2,
      xScale: shapeObj.width / 2,
      yScale: shapeObj.height / 2,
      borderColor: rgb(sr, sg, sb),
      borderWidth: shapeObj.strokeWidth,
      color: hasFill ? rgb(fr, fg, fb) : undefined,
      opacity: shapeObj.opacity / 100,
    });
  } else if (shapeObj.shapeKind === 'line' || shapeObj.shapeKind === 'arrow') {
    const startX = shapeObj.x;
    const startY = drawY + shapeObj.height / 2;
    const endX = shapeObj.x + shapeObj.width;
    const endY = drawY + shapeObj.height / 2;
    const strokeRgb = rgb(sr, sg, sb);
    const op = shapeObj.opacity / 100;
    page.drawLine({
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      color: strokeRgb,
      thickness: shapeObj.strokeWidth,
      opacity: op,
    });
    if (shapeObj.shapeKind === 'arrow') {
      const headSize = Math.max(8, shapeObj.strokeWidth * 3);
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      const tip = { x: endX, y: endY };
      const base1 = {
        x: endX - ux * headSize + px * (headSize / 2),
        y: endY - uy * headSize + py * (headSize / 2),
      };
      const base2 = {
        x: endX - ux * headSize - px * (headSize / 2),
        y: endY - uy * headSize - py * (headSize / 2),
      };
      page.drawLine({ start: tip, end: base1, color: strokeRgb, thickness: shapeObj.strokeWidth, opacity: op });
      page.drawLine({ start: tip, end: base2, color: strokeRgb, thickness: shapeObj.strokeWidth, opacity: op });
      page.drawLine({ start: base1, end: base2, color: strokeRgb, thickness: shapeObj.strokeWidth, opacity: op });
    }
  }
}

// ─── Symbols ───────────────────────────────────────────────

function drawSymbol(
  page: import('pdf-lib').PDFPage,
  symObj: SymbolObject,
  drawY: number,
  rgb: PDFLib['rgb'],
) {
  const [cr, cg, cb] = hexToRgb(symObj.color);
  const color = rgb(cr, cg, cb);
  if (symObj.symbolKind === 'check') {
    page.drawLine({
      start: { x: symObj.x + symObj.width * 0.2, y: drawY + symObj.height * 0.5 },
      end: { x: symObj.x + symObj.width * 0.4, y: drawY + symObj.height * 0.25 },
      color,
      thickness: symObj.strokeWidth,
    });
    page.drawLine({
      start: { x: symObj.x + symObj.width * 0.4, y: drawY + symObj.height * 0.25 },
      end: { x: symObj.x + symObj.width * 0.8, y: drawY + symObj.height * 0.75 },
      color,
      thickness: symObj.strokeWidth,
    });
  } else {
    page.drawLine({
      start: { x: symObj.x + symObj.width * 0.2, y: drawY + symObj.height * 0.8 },
      end: { x: symObj.x + symObj.width * 0.8, y: drawY + symObj.height * 0.2 },
      color,
      thickness: symObj.strokeWidth,
    });
    page.drawLine({
      start: { x: symObj.x + symObj.width * 0.8, y: drawY + symObj.height * 0.8 },
      end: { x: symObj.x + symObj.width * 0.2, y: drawY + symObj.height * 0.2 },
      color,
      thickness: symObj.strokeWidth,
    });
  }
}

// ─── Paths ─────────────────────────────────────────────────

function drawPath(
  page: import('pdf-lib').PDFPage,
  pathObj: PathObject,
  drawY: number,
  pageHeight: number,
  rgb: PDFLib['rgb'],
) {
  const [pr, pg, pb] = hexToRgb(pathObj.color);
  const color = rgb(pr, pg, pb);
  if (pathObj.type === 'highlight') {
    page.drawRectangle({
      x: pathObj.x,
      y: drawY,
      width: pathObj.width,
      height: pathObj.height,
      color,
      opacity: (pathObj.opacity || 40) / 100,
    });
  } else if (pathObj.points.length >= 2) {
    for (let i = 0; i < pathObj.points.length - 1; i++) {
      page.drawLine({
        start: { x: pathObj.points[i].x, y: pageHeight - pathObj.points[i].y },
        end: { x: pathObj.points[i + 1].x, y: pageHeight - pathObj.points[i + 1].y },
        color,
        thickness: pathObj.strokeWidth,
        opacity: pathObj.opacity / 100,
      });
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────

function parsePageIndex(pageId: string): number {
  const match = pageId.match(/page-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function hexToRgb(hex: string): [number, number, number] {
  if (!hex || hex === 'transparent') return [1, 1, 1];
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [0, 0, 0];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
