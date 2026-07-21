// ============================================================
// PDF page count utility — lazy import pdfjs-dist
// ============================================================
//
// Chỉ dùng ở ReplaceBookDialog để compare page count 2 file. Lazy import
// tránh nạp pdfjs vào chunk chính (Library.tsx) nếu user không dùng feature.
// ============================================================

/**
 * Đếm số trang PDF client-side. Return số trang hoặc null nếu parse fail.
 */
export async function getPdfPageCount(file: File): Promise<number | null> {
  try {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
    // Worker path đã config ở nơi khác (Reader). Nếu chưa, fallback dùng
    // fake worker (chậm hơn nhưng work).
    if (!GlobalWorkerOptions.workerSrc) {
      // eslint-disable-next-line no-console
      console.warn('[pdf-page-count] worker chưa config, dùng fake worker');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[pdf-page-count] fail parse ${file.name}: ${err instanceof Error ? err.message : 'unknown'}`,
    );
    return null;
  }
}