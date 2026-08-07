// ============================================================
// PDF Studio Edit PDF — Thumbnail sidebar with lazy rendering
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/cn';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface EditorThumbnailsProps {
  pdfDoc: PDFDocumentProxy | null;
  totalPages: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
}

const THUMB_WIDTH = 100;

export function EditorThumbnails({ pdfDoc, totalPages, currentPage, onPageSelect }: EditorThumbnailsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderedPages, setRenderedPages] = useState<Map<number, string>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Render a single thumbnail
  const renderThumbnail = useCallback(async (pageNum: number) => {
    if (!pdfDoc || renderedPages.has(pageNum)) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const scale = THUMB_WIDTH / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      setRenderedPages((prev) => new Map(prev).set(pageNum, dataUrl));
    } catch {
      // Non-critical: page thumbnail failed
    }
  }, [pdfDoc, renderedPages]);

  // Setup IntersectionObserver for lazy rendering
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute('data-page'));
            if (pageNum > 0) renderThumbnail(pageNum);
          }
        }
      },
      { root: containerRef.current, rootMargin: '100px 0px' },
    );

    // Observe all items
    for (const [, el] of itemRefs.current) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [pdfDoc, totalPages, renderThumbnail]);

  // Scroll current page into view
  useEffect(() => {
    const el = itemRefs.current.get(currentPage);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentPage]);

  // Reset rendered pages when document changes
  useEffect(() => {
    setRenderedPages(new Map());
  }, [pdfDoc]);

  if (!pdfDoc || totalPages === 0) {
    return (
      <aside className="hidden sm:flex w-36 flex-col border-r border-border bg-muted/30 p-2 items-center justify-center">
        <p className="text-[10px] text-muted-foreground text-center">Thumbnails</p>
      </aside>
    );
  }

  return (
    <aside
      ref={containerRef}
      className="hidden sm:flex w-36 flex-col border-r border-border bg-muted/30 p-2 overflow-y-auto gap-2"
    >
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
        <div
          key={pageNum}
          ref={(el) => { if (el) itemRefs.current.set(pageNum, el); }}
          data-page={pageNum}
          onClick={() => onPageSelect(pageNum)}
          className={cn(
            'flex flex-col items-center gap-1 rounded p-1 cursor-pointer transition-colors',
            'hover:bg-primary/5',
            currentPage === pageNum && 'bg-primary/10 ring-1 ring-primary/40',
          )}
        >
          <div className="w-full aspect-[3/4] bg-white border border-border rounded-sm overflow-hidden flex items-center justify-center">
            {renderedPages.has(pageNum) ? (
              <img
                src={renderedPages.get(pageNum)}
                alt={`Trang ${pageNum}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-[9px] text-muted-foreground">{pageNum}</span>
            )}
          </div>
          <span className="text-[9px] text-muted-foreground">{pageNum}</span>
        </div>
      ))}
    </aside>
  );
}
