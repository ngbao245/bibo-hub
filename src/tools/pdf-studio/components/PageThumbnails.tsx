// ============================================================
// PDF Studio — Page thumbnail renderer (pdf.js)
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

interface PageThumbnailsProps {
  file: File;
  /** Pages marked for selection (1-indexed) */
  selectedPages?: Set<number>;
  onPageClick?: (pageNum: number) => void;
  /** Render scissors separator between pages */
  splitPoints?: Set<number>;
  onSplitToggle?: (afterPage: number) => void;
  className?: string;
}

interface PageInfo {
  pageNum: number;
  canvas: HTMLCanvasElement | null;
  rendered: boolean;
}

// Min cell width; grid auto-fill sẽ nhân số cột theo container.
// Canvas render ở scale mà width ≈ cell width thực tế (co giãn qua CSS).
const THUMB_MIN_WIDTH = 160;

export function PageThumbnails({
  file,
  selectedPages,
  onPageClick,
  splitPoints,
  onSplitToggle,
  className,
}: PageThumbnailsProps) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const pdfRef = useRef<unknown>(null);

  // Load PDF and get page count
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
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
        if (cancelled) { pdf.destroy(); return; }

        pdfRef.current = pdf;
        setTotalPages(pdf.numPages);
        setPages(
          Array.from({ length: pdf.numPages }, (_, i) => ({
            pageNum: i + 1,
            canvas: null,
            rendered: false,
          })),
        );
      } catch {
        setPages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [file]);

  // Render individual page thumbnail
  const renderPage = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
    const pdf = pdfRef.current as { getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: unknown) => { promise: Promise<void> } }> } | null;
    if (!pdf) return;

    try {
      const page = await pdf.getPage(pageNum);
      // Render at 2x min width để crisp khi cell to hơn min do container rộng.
      const viewport = page.getViewport({ scale: (THUMB_MIN_WIDTH * 2) / page.getViewport({ scale: 1 }).width });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch {
      // Render failed — leave blank
    }
  }, []);

  // Ref callback for each canvas
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    // Render all pages (lazy render could be added with IntersectionObserver later)
    for (const [pageNum, canvas] of canvasRefs.current) {
      renderPage(pageNum, canvas);
    }
  }, [pages, renderPage]);

  if (loading) {
    return (
      <div className={cn('flex flex-wrap gap-3', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[160px] w-[120px] rounded" />
        ))}
      </div>
    );
  }

  if (totalPages === 0) {
    return <p className="text-xs text-muted-foreground">Không thể đọc trang PDF</p>;
  }

  const showScissors = Boolean(onSplitToggle);

  return (
    <div
      className={cn('grid gap-3', className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_MIN_WIDTH}px, 1fr))` }}
    >
      {pages.map((page, i) => (
        <div key={page.pageNum} className="relative flex flex-col items-center gap-1">
          {/* Page thumbnail */}
          <div
            className={cn(
              'relative w-full cursor-pointer rounded border-2 transition-[color,background-color,border-color] duration-150 ease-in-out',
              selectedPages?.has(page.pageNum)
                ? 'border-destructive bg-destructive/10'
                : 'border-border hover:border-primary/50',
            )}
            onClick={() => onPageClick?.(page.pageNum)}
            role="button"
            tabIndex={0}
            aria-label={`Trang ${page.pageNum}`}
            onKeyDown={(e) => { if (e.key === 'Enter') onPageClick?.(page.pageNum); }}
          >
            <canvas
              ref={(el) => {
                if (el) {
                  canvasRefs.current.set(page.pageNum, el);
                  renderPage(page.pageNum, el);
                }
              }}
              className="rounded"
              style={{ width: '100%', display: 'block' }}
            />
            {/* Page number */}
            <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 text-[10px] text-foreground">
              {page.pageNum}
            </span>
            {/* Selected overlay */}
            {selectedPages?.has(page.pageNum) && (
              <div className="absolute inset-0 flex items-center justify-center rounded bg-destructive/20">
                <span className="text-2xl font-bold text-destructive">✕</span>
              </div>
            )}
          </div>

          {/* Scissors separator dưới thumbnail (không phải cuối) */}
          {i < pages.length - 1 && showScissors && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSplitToggle?.(page.pageNum); }}
              className={cn(
                'flex h-6 w-full items-center justify-center gap-1.5 rounded text-[10px] font-medium transition-colors',
                splitPoints?.has(page.pageNum)
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground/60 hover:bg-primary/10 hover:text-primary',
              )}
              aria-label={`Cắt sau trang ${page.pageNum}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
              <span>Cắt tại đây</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
