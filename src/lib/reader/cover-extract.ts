// Cover extraction — render trang 1 PDF ra canvas, export PNG blob.
// Best-effort: trả null nếu fail.

import { pdfjs } from 'react-pdf';
import '@/lib/reader/pdfjs-setup';

export interface CoverResult {
  blob: Blob;
  ext: 'png';
}

export async function extractPdfCover(file: File): Promise<CoverResult | null> {
  try {
    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 0.9),
    );
    await doc.destroy();
    if (!blob) return null;
    return { blob, ext: 'png' };
  } catch {
    return null;
  }
}