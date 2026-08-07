// ============================================================
// PDF Studio — PDF scan classification (off-main-thread ready)
// ============================================================
// Classifies a PDF as:
//   - 'text': has extractable text layer
//   - 'scan': fully image-based (no text)
//   - 'mixed': some pages have text, some don't
//
// Strategy: sample pages and check for text content.
// Uses pdf.js to extract text from sampled pages.
// Designed to be callable from a Worker or main thread.
// ============================================================

import type { ScanType } from './formats';

/**
 * Lightweight PDF scan detection.
 * Samples up to `maxPages` and checks text content length.
 * A page with < threshold characters is considered "scan".
 */
export async function classifyPdf(
  file: File,
  options?: { maxPages?: number; textThreshold?: number },
): Promise<ScanType> {
  const maxPages = options?.maxPages ?? 5;
  const threshold = options?.textThreshold ?? 10;

  try {
    // Dynamic import pdf.js to keep bundle small
    const pdfjsLib = await import('pdfjs-dist');

    // Use worker from CDN if available, fallback to inline
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const totalPages = pdf.numPages;
    const pagesToSample = Math.min(totalPages, maxPages);

    // Sample evenly distributed pages
    const indices: number[] = [];
    if (pagesToSample <= 1) {
      indices.push(1);
    } else {
      for (let i = 0; i < pagesToSample; i++) {
        indices.push(Math.floor((i / (pagesToSample - 1)) * (totalPages - 1)) + 1);
      }
    }

    let pagesWithText = 0;
    let pagesWithoutText = 0;

    for (const pageNum of indices) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join('')
        .trim();

      if (text.length >= threshold) {
        pagesWithText++;
      } else {
        pagesWithoutText++;
      }
    }

    pdf.destroy();

    if (pagesWithText === 0) return 'scan';
    if (pagesWithoutText === 0) return 'text';
    return 'mixed';
  } catch {
    // If we can't parse the PDF, assume text (don't block conversion)
    return 'text';
  }
}

/**
 * Quick check: is this PDF encrypted/password-protected?
 * Returns true if encrypted (cannot be classified).
 */
export async function isPdfEncrypted(file: File): Promise<boolean> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    pdf.destroy();
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    return msg.includes('password') || msg.includes('encrypted');
  }
}
