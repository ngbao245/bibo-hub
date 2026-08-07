// ============================================================
// PDF Studio — Shared operations
// ============================================================
// Client-side (pdf-lib + pdf.js): merge, split, remove pages, rotate, crop,
//                                 pdf-to-images.
// Server-side (iLovePDF): compress, unlock, watermark (bước 2 sẽ client),
//                          + convert Office / OCR ở path khác.
//
// Client-side rationale: 7 op này là "copy/edit PDF metadata" — pdf-lib làm
// bit-identical output với iLovePDF. Chuyển sang client-side → instant,
// khỏi tốn credit, offline được, không cần backend.
// ============================================================

import { serverExecutor } from '@/lib/service-registry/server-executor';
import type { IlovepdfDescriptor } from '@/lib/service-registry/server-executor';

// ─── Types (public API) ─────────────────────────────────────

export type CompressionLevel = 'low' | 'recommended' | 'extreme';

export interface CompressResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

export interface CropMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RotateSpec {
  /** 1-indexed page number */
  page: number;
  /** 0 | 90 | 180 | 270 */
  angle: number;
}

export interface PdfToImagesOptions {
  format?: 'png' | 'jpg';
  /** 1 = 72dpi, 2 = 144dpi, 3 = 216dpi. Default 2. */
  scale?: number;
  /** JPEG quality 0-1. Default 0.92. */
  quality?: number;
}

export interface WatermarkPdfOptions {
  text: string;
  position: 'center' | 'bottom' | 'top';
  /** 10-100 */
  opacity: number;
  /** 0-360 */
  rotation: number;
}

// ─── Client-side helpers ────────────────────────────────────

/** Load PDF với error message thân thiện, throw sớm nếu encrypted. */
async function loadPdfDoc(file: File | Blob) {
  const { PDFDocument } = await import('pdf-lib');
  const bytes = await file.arrayBuffer();
  try {
    return await PDFDocument.load(bytes);
  } catch (err) {
    if (err instanceof Error && /encrypt/i.test(err.message)) {
      throw new Error('File có mật khẩu — dùng Mở khoá trước.');
    }
    throw new Error('File PDF lỗi hoặc không đọc được.');
  }
}

/**
 * Parse range spec cho split.
 * - "1-3,5,7-end" → [[0,1,2], [4], [6,7,...]]
 * - "fixed_range:5" → chia mỗi 5 trang
 * Trả về mảng nhóm page index 0-indexed.
 */
export function parseRanges(spec: string, totalPages: number): number[][] {
  const trimmed = spec.trim();
  if (!trimmed) throw new Error('Chưa nhập range');

  if (trimmed.startsWith('fixed_range:')) {
    const step = parseInt(trimmed.replace('fixed_range:', ''), 10);
    if (!step || step < 1) throw new Error('Fixed range không hợp lệ');
    const groups: number[][] = [];
    for (let i = 0; i < totalPages; i += step) {
      groups.push(Array.from({ length: Math.min(step, totalPages - i) }, (_, k) => i + k));
    }
    return groups;
  }

  return trimmed.split(',').map((raw) => {
    const t = raw.trim();
    if (!t) throw new Error('Range trống — bỏ dấu phẩy dư');
    if (!t.includes('-')) {
      const p = parseInt(t, 10);
      if (isNaN(p) || p < 1 || p > totalPages) throw new Error(`Trang "${t}" ngoài phạm vi (1-${totalPages})`);
      return [p - 1];
    }
    const [aRaw, bRaw] = t.split('-');
    const a = parseInt(aRaw, 10);
    const b = bRaw.trim().toLowerCase() === 'end' ? totalPages : parseInt(bRaw, 10);
    if (isNaN(a) || isNaN(b) || a < 1 || b > totalPages || a > b) {
      throw new Error(`Range "${t}" không hợp lệ (mong đợi 1-${totalPages})`);
    }
    return Array.from({ length: b - a + 1 }, (_, k) => a - 1 + k);
  });
}

// ─── CLIENT-SIDE OPS ─────────────────────────────────────────

/**
 * Gộp nhiều PDF thành 1 file — pdf-lib client-side.
 * Output identical với iLovePDF (chỉ copy pages, không đụng content).
 */
export async function mergePdfs(files: File[]): Promise<Blob> {
  if (files.length < 2) throw new Error('Cần ít nhất 2 file để gộp');
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const file of files) {
    const src = await loadPdfDoc(file);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const bytes = await out.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

export type PageNumberPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type PageNumberFontFamily = 'helvetica' | 'times' | 'courier';

export interface PageNumberOptions {
  position: PageNumberPosition;
  format: string;
  startNumber: number;
  fontSize: number;
  margin: number;
  fontFamily: PageNumberFontFamily;
  bold: boolean;
  italic: boolean;
  /** Hex color VD "#000000" */
  color: string;
  /** 1-indexed inclusive. undefined = start from 1 / end at last */
  fromPage?: number;
  toPage?: number;
  /** Skip cover — không đánh trang đầu tiên */
  skipCover: boolean;
}

function pickStandardFont(family: PageNumberFontFamily, bold: boolean, italic: boolean) {
  // Names từ pdf-lib StandardFonts enum
  if (family === 'times') {
    if (bold && italic) return 'TimesRomanBoldItalic';
    if (bold) return 'TimesRomanBold';
    if (italic) return 'TimesRomanItalic';
    return 'TimesRoman';
  }
  if (family === 'courier') {
    if (bold && italic) return 'CourierBoldOblique';
    if (bold) return 'CourierBold';
    if (italic) return 'CourierOblique';
    return 'Courier';
  }
  // helvetica default
  if (bold && italic) return 'HelveticaBoldOblique';
  if (bold) return 'HelveticaBold';
  if (italic) return 'HelveticaOblique';
  return 'Helvetica';
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  return {
    r: ((num >> 16) & 0xff) / 255,
    g: ((num >> 8) & 0xff) / 255,
    b: (num & 0xff) / 255,
  };
}

/**
 * Thêm số trang vào PDF — pdf-lib native `drawText` để giữ text
 * SELECTABLE / SEARCHABLE / EXTRACTABLE.
 */
export async function addPageNumbers(
  file: File,
  options: PageNumberOptions,
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const fontName = pickStandardFont(options.fontFamily, options.bold, options.italic);
  const font = await doc.embedFont(
    (StandardFonts as unknown as Record<string, string>)[fontName],
  );
  const c = hexToRgb01(options.color);

  const pages = doc.getPages();
  const total = pages.length;
  const {
    position,
    format,
    startNumber,
    fontSize,
    margin,
    fromPage,
    toPage,
    skipCover,
  } = options;

  const effectiveFrom = Math.max(1, skipCover ? 2 : (fromPage ?? 1));
  const effectiveTo = Math.min(total, toPage ?? total);

  let displayNum = startNumber;
  for (let i = 0; i < total; i++) {
    const pageIdx1based = i + 1;
    if (pageIdx1based < effectiveFrom || pageIdx1based > effectiveTo) continue;

    const page = pages[i];
    const text = format
      .replace(/\{n\}/g, String(displayNum))
      .replace(/\{total\}/g, String(effectiveTo - effectiveFrom + 1))
      .replace(/\{start\}/g, String(startNumber));

    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    let x = 0;
    let y = 0;
    switch (position) {
      case 'top-left':
        x = margin;
        y = height - margin - textHeight;
        break;
      case 'top-center':
        x = (width - textWidth) / 2;
        y = height - margin - textHeight;
        break;
      case 'top-right':
        x = width - margin - textWidth;
        y = height - margin - textHeight;
        break;
      case 'bottom-left':
        x = margin;
        y = margin;
        break;
      case 'bottom-center':
        x = (width - textWidth) / 2;
        y = margin;
        break;
      case 'bottom-right':
        x = width - margin - textWidth;
        y = margin;
        break;
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(c.r, c.g, c.b),
    });
    displayNum++;
  }

  const outBytes = await doc.save();
  return new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' });
}

export interface PageSpec {
  file: File;
  /** 1-indexed page number in source file */
  pageNum: number;
  /** Cumulative visual rotation applied by user (any int, will normalize to 0/90/180/270) */
  rotation: number;
}

/**
 * Gộp theo danh sách trang cụ thể (cross-file) — dùng cho Pages view.
 * Cache PDFDocument theo File reference để không load 1 file nhiều lần.
 */
export async function mergePages(specs: PageSpec[]): Promise<Blob> {
  if (specs.length < 1) throw new Error('Cần ít nhất 1 trang để gộp');
  const { PDFDocument, degrees } = await import('pdf-lib');
  const out = await PDFDocument.create();

  // Cache đã load để 1 file có nhiều trang không phải re-parse.
  type PdfLibDoc = Awaited<ReturnType<typeof loadPdfDoc>>;
  const fileCache = new Map<File, PdfLibDoc>();

  for (const spec of specs) {
    let src = fileCache.get(spec.file);
    if (!src) {
      src = await loadPdfDoc(spec.file);
      fileCache.set(spec.file, src);
    }
    const idx = spec.pageNum - 1;
    if (idx < 0 || idx >= src.getPageCount()) continue;
    const [copied] = await out.copyPages(src, [idx]);

    // Apply user rotation trên top existing rotation của source page.
    const angle = ((spec.rotation % 360) + 360) % 360;
    if ([0, 90, 180, 270].includes(angle) && angle !== 0) {
      const existing = copied.getRotation().angle;
      copied.setRotation(degrees(((existing + angle) % 360 + 360) % 360));
    }
    out.addPage(copied);
  }

  const bytes = await out.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/**
 * Tách theo danh sách trang cross-file (multi-file input) + groups split.
 * `groups` = mảng nhóm, mỗi nhóm là mảng index vào `specs`. Output:
 *  - groups.length === 1 → single PDF blob
 *  - groups.length > 1 → ZIP nhiều PDF
 */
export async function splitPages(
  specs: PageSpec[],
  groups: number[][],
  baseName = 'split',
): Promise<Blob> {
  if (specs.length === 0) throw new Error('Cần ít nhất 1 trang để tách');
  if (groups.length === 0) throw new Error('Chưa có nhóm split nào');
  const { PDFDocument, degrees } = await import('pdf-lib');

  type PdfLibDoc = Awaited<ReturnType<typeof loadPdfDoc>>;
  const fileCache = new Map<File, PdfLibDoc>();
  const outputs: { name: string; bytes: Uint8Array }[] = [];

  for (let g = 0; g < groups.length; g++) {
    const out = await PDFDocument.create();
    for (const specIdx of groups[g]) {
      const spec = specs[specIdx];
      if (!spec) continue;
      let src = fileCache.get(spec.file);
      if (!src) {
        src = await loadPdfDoc(spec.file);
        fileCache.set(spec.file, src);
      }
      const idx = spec.pageNum - 1;
      if (idx < 0 || idx >= src.getPageCount()) continue;
      const [copied] = await out.copyPages(src, [idx]);
      const angle = ((spec.rotation % 360) + 360) % 360;
      if ([0, 90, 180, 270].includes(angle) && angle !== 0) {
        const existing = copied.getRotation().angle;
        copied.setRotation(degrees(((existing + angle) % 360 + 360) % 360));
      }
      out.addPage(copied);
    }
    outputs.push({
      name: `${baseName}-part${g + 1}.pdf`,
      bytes: await out.save(),
    });
  }

  if (outputs.length === 1) {
    return new Blob([new Uint8Array(outputs[0].bytes)], { type: 'application/pdf' });
  }
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  outputs.forEach((o) => zip.file(o.name, o.bytes));
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Extract subset trang theo danh sách chọn.
 * `separate=false` → 1 PDF combined tất cả trang selected
 * `separate=true`  → ZIP, mỗi trang 1 file PDF riêng
 */
export async function extractPages(
  specs: PageSpec[],
  separate: boolean,
  baseName = 'extract',
): Promise<Blob> {
  if (specs.length === 0) throw new Error('Chưa chọn trang nào để extract');
  const { PDFDocument, degrees } = await import('pdf-lib');
  type PdfLibDoc = Awaited<ReturnType<typeof loadPdfDoc>>;
  const fileCache = new Map<File, PdfLibDoc>();

  const copyOne = async (out: import('pdf-lib').PDFDocument, spec: PageSpec) => {
    let src = fileCache.get(spec.file);
    if (!src) {
      src = await loadPdfDoc(spec.file);
      fileCache.set(spec.file, src);
    }
    const idx = spec.pageNum - 1;
    if (idx < 0 || idx >= src.getPageCount()) return;
    const [copied] = await out.copyPages(src, [idx]);
    const angle = ((spec.rotation % 360) + 360) % 360;
    if ([0, 90, 180, 270].includes(angle) && angle !== 0) {
      const existing = copied.getRotation().angle;
      copied.setRotation(degrees(((existing + angle) % 360 + 360) % 360));
    }
    out.addPage(copied);
  };

  if (!separate) {
    const out = await PDFDocument.create();
    for (const spec of specs) await copyOne(out, spec);
    const bytes = await out.save();
    return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  }

  // Separate: 1 file / trang → ZIP
  const outputs: { name: string; bytes: Uint8Array }[] = [];
  for (let i = 0; i < specs.length; i++) {
    const out = await PDFDocument.create();
    await copyOne(out, specs[i]);
    outputs.push({
      name: `${baseName}-p${i + 1}.pdf`,
      bytes: await out.save(),
    });
  }
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  outputs.forEach((o) => zip.file(o.name, o.bytes));
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Tách PDF theo ranges — pdf-lib client-side.
 * Return type Blob:
 *  - 1 group  → application/pdf (single PDF)
 *  - N groups → application/zip (nhiều PDF trong zip)
 * Consumer detect qua `blob.type` để chọn extension khi download.
 */
export async function splitPdf(file: File, ranges: string): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const src = await loadPdfDoc(file);
  const totalPages = src.getPageCount();
  const groups = parseRanges(ranges, totalPages);
  if (groups.length === 0) throw new Error('Chưa có range nào');

  const outputs: { name: string; bytes: Uint8Array }[] = [];
  const baseName = file.name.replace(/\.pdf$/i, '');

  for (let i = 0; i < groups.length; i++) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(src, groups[i]);
    pages.forEach((p) => doc.addPage(p));
    outputs.push({
      name: `${baseName}-part${i + 1}.pdf`,
      bytes: await doc.save(),
    });
  }

  if (outputs.length === 1) {
    return new Blob([new Uint8Array(outputs[0].bytes)], { type: 'application/pdf' });
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  outputs.forEach((o) => zip.file(o.name, o.bytes));
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Xoá trang (1-indexed) — pdf-lib client-side.
 */
export async function removePdfPages(file: File, pages: number[]): Promise<Blob> {
  if (pages.length === 0) throw new Error('Chưa chọn trang cần xoá');
  const doc = await loadPdfDoc(file);
  const total = doc.getPageCount();

  // Convert 1-indexed → 0-indexed, dedupe, filter range, sort DESC to
  // remove without index shift.
  const indices = Array.from(new Set(pages.map((p) => p - 1)))
    .filter((i) => i >= 0 && i < total)
    .sort((a, b) => b - a);

  if (indices.length === 0) throw new Error('Không có trang hợp lệ để xoá');
  if (indices.length >= total) throw new Error('Không thể xoá tất cả trang');

  for (const i of indices) doc.removePage(i);
  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/**
 * Xoay trang — pdf-lib client-side.
 * Angle chỉ chấp nhận 0/90/180/270 (PDF spec).
 */
export async function rotatePdfPages(file: File, rotations: RotateSpec[]): Promise<Blob> {
  if (rotations.length === 0) throw new Error('Chưa có thay đổi xoay nào');
  const { degrees } = await import('pdf-lib');
  const doc = await loadPdfDoc(file);
  const total = doc.getPageCount();

  for (const r of rotations) {
    const idx = r.page - 1;
    if (idx < 0 || idx >= total) continue;
    const angle = ((r.angle % 360) + 360) % 360;
    if (![0, 90, 180, 270].includes(angle)) continue;
    doc.getPage(idx).setRotation(degrees(angle));
  }

  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/**
 * Cắt xén margin PDF — pdf-lib client-side (set CropBox).
 * Margins tính bằng point (1pt = 1/72 inch).
 */
export async function cropPdf(file: File, margins: CropMargins): Promise<Blob> {
  const doc = await loadPdfDoc(file);
  const pages = doc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const cropW = width - margins.left - margins.right;
    const cropH = height - margins.top - margins.bottom;
    if (cropW <= 0 || cropH <= 0) {
      throw new Error('Margin quá lớn — vùng còn lại rỗng');
    }
    page.setCropBox(margins.left, margins.bottom, cropW, cropH);
  }
  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/**
 * PDF → PNG/JPG — pdf.js render canvas + toBlob.
 * 1 trang → image blob single.
 * Nhiều trang → zip.
 */
export async function pdfToImages(file: File, options: PdfToImagesOptions = {}): Promise<Blob> {
  const format = options.format ?? 'png';
  const scale = options.scale ?? 2;
  const quality = options.quality ?? 0.92;
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';

  const pdfjs = await import('pdfjs-dist');
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const baseName = file.name.replace(/\.pdf$/i, '');
  const images: { name: string; blob: Blob }[] = [];

  try {
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không tạo được canvas context');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error(`Convert trang ${i} thất bại`))),
          mimeType,
          quality,
        );
      });
      images.push({ name: `${baseName}-p${i}.${format}`, blob });
    }
  } finally {
    pdfDoc.destroy();
  }

  if (images.length === 1) return images[0].blob;

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const img of images) {
    zip.file(img.name, await img.blob.arrayBuffer());
  }
  return await zip.generateAsync({ type: 'blob' });
}

// ─── SERVER-SIDE OPS (thuật toán độc quyền / limit kỹ thuật) ─

async function getIlovepdfDescriptor(tool: string): Promise<IlovepdfDescriptor | null> {
  const result = await serverExecutor.execute({
    toolCode: 'pdf_studio',
    capability: `pdf.${tool}`,
    payload: { tool },
  });
  if (!result.success || !result.descriptor) return null;
  if (result.descriptor.type !== 'direct_upload') return null;
  return result.descriptor as IlovepdfDescriptor;
}

async function uploadFile(descriptor: IlovepdfDescriptor, file: File): Promise<string> {
  const form = new FormData();
  form.append('task', descriptor.task);
  form.append('file', file, file.name);
  const res = await fetch(`https://${descriptor.server}/v1/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${descriptor.token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.server_filename;
}

async function processAndDownload(
  descriptor: IlovepdfDescriptor,
  tool: string,
  files: Array<{ server_filename: string; filename: string }>,
  extraParams?: Record<string, unknown>,
): Promise<Blob> {
  const processRes = await fetch(`https://${descriptor.server}/v1/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${descriptor.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ task: descriptor.task, tool, files, ...extraParams }),
  });
  if (!processRes.ok) {
    const err = await processRes.json().catch(() => ({}));
    throw new Error(
      `Process failed: ${(err as { error?: { message?: string } }).error?.message ?? `HTTP ${processRes.status}`}`,
    );
  }
  const downloadRes = await fetch(
    `https://${descriptor.server}/v1/download/${descriptor.task}`,
    { headers: { Authorization: `Bearer ${descriptor.token}` } },
  );
  if (!downloadRes.ok) throw new Error('Download failed');
  return downloadRes.blob();
}

/**
 * Nén PDF — SERVER (iLovePDF thuật toán độc quyền, giảm 60-80%).
 * Client-side pdf-lib chỉ giảm được ~10-15% nên không đáng để thay.
 */
export async function compressPdf(
  file: File,
  level: CompressionLevel = 'recommended',
): Promise<CompressResult> {
  const desc = await getIlovepdfDescriptor('compress');
  if (!desc) throw new Error('Không lấy được credential nén PDF');
  const serverFilename = await uploadFile(desc, file);
  const blob = await processAndDownload(
    desc,
    'compress',
    [{ server_filename: serverFilename, filename: file.name }],
    { compression_level: level },
  );
  return {
    blob,
    originalSize: file.size,
    compressedSize: blob.size,
    ratio: file.size > 0 ? blob.size / file.size : 1,
  };
}

/**
 * Mở khoá PDF — SERVER (pdf-lib không hỗ trợ decrypt content stream).
 */
export async function unlockPdf(file: File, password: string): Promise<Blob> {
  if (!password) throw new Error('Chưa nhập mật khẩu');
  const desc = await getIlovepdfDescriptor('unlock');
  if (!desc) throw new Error('Không lấy được credential mở khoá');
  const serverFilename = await uploadFile(desc, file);
  return processAndDownload(
    desc,
    'unlock',
    [{ server_filename: serverFilename, filename: file.name }],
    { password },
  );
}

/**
 * Khoá PDF bằng mật khẩu — SERVER (pdf-lib không support encryption).
 * User cần password để mở file sau khi lock.
 */
export async function lockPdf(file: File, password: string): Promise<Blob> {
  if (!password) throw new Error('Chưa nhập mật khẩu');
  const desc = await getIlovepdfDescriptor('protect');
  if (!desc) throw new Error('Không lấy được credential khoá PDF');
  const serverFilename = await uploadFile(desc, file);
  return processAndDownload(
    desc,
    'protect',
    [{ server_filename: serverFilename, filename: file.name }],
    { password },
  );
}

/**
 * Watermark PDF — CLIENT-SIDE với canvas API render text.
 * Full Unicode (tiếng Việt) qua font hệ thống, không cần font asset external.
 * WYSIWYG: preview UI dùng cùng hàm `renderWatermarkOnCanvas` → chắc chắn
 * output cuối trông giống hệt preview.
 */
export async function addWatermarkPdf(file: File, options: WatermarkPdfOptions): Promise<Blob> {
  if (!options.text.trim()) throw new Error('Chưa nhập text watermark');

  const { PDFDocument } = await import('pdf-lib');
  const { renderWatermarkOnCanvas } = await import('./watermark-render');

  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Render watermark to offscreen canvas at page size (1pt = 1px)
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Không tạo được canvas 2D context');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderWatermarkOnCanvas(ctx, options, canvas.width, canvas.height);

    // Canvas → PNG blob → PDF image
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob thất bại'))),
        'image/png',
      );
    });
    const pngBytes = await pngBlob.arrayBuffer();
    const pngImage = await pdfDoc.embedPng(pngBytes);

    // Draw as full-page overlay; pdf-lib drawImage đặt image với origin
    // bottom-left của bbox, nhưng pixel row 0 của PNG (top canvas) map vào
    // top của bbox → preserved orientation, không cần flip.
    page.drawImage(pngImage, { x: 0, y: 0, width, height });
  }

  const outBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' });
}
