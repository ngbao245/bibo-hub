// ============================================================
// PDF Studio Edit PDF — PDF Viewer (render, zoom, pan, navigate)
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { LoadingState, ErrorState } from '@/components/shared';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Minimal textLayer CSS (from pdfjs-dist/web/pdf_viewer.css)
const TEXT_LAYER_CSS = `
.textLayer {
  position: absolute;
  text-align: initial;
  inset: 0;
  overflow: hidden;
  opacity: 1;
  line-height: 1;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  caret-color: CanvasText;
  z-index: 2;
}
.textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
  box-sizing: content-box;
}
/* Enlarge selection hit area without shifting glyphs. Sizes are in em so they
   scale with each span's font-size (unaffected by the scaleX transform).
   - margin-top compensates padding-top so the glyph does not move.
   - padding-bottom clears the descender (which overflows the line-height:1 box
     by ~0.07em) plus breathing room below g/j/p/q/y.
   Reversed z-index (set in JS after render) makes each line WIN the overlap with
   the line below, so its padding-bottom is actually effective for hit-testing. */
.textLayer span:not(.markedContent) {
  padding-top: 0.18em;
  padding-bottom: 0.32em;
  padding-right: 0.3em;
  margin-top: -0.18em;
}
.textLayer span.markedContent {
  top: 0;
  height: 0;
}
.textLayer .highlight {
  margin: -1px;
  padding: 1px;
  background-color: rgba(180, 0, 170, 0.2);
  border-radius: 4px;
}
.textLayer .highlight.appended {
  position: initial;
}
.textLayer .highlight.begin {
  border-radius: 4px 0 0 4px;
}
.textLayer .highlight.end {
  border-radius: 0 4px 4px 0;
}
.textLayer .highlight.middle {
  border-radius: 0;
}
.textLayer .highlight.selected {
  background-color: rgba(0, 100, 0, 0.2);
}
.textLayer ::selection {
  background: rgba(0, 0, 255, 0.25);
}
.textLayer br::selection {
  background: transparent;
}
.textLayer .endOfContent {
  display: block;
  position: absolute;
  inset: 100% 0 0;
  z-index: -1;
  cursor: default;
  user-select: none;
}
.textLayer .endOfContent.active {
  top: 0;
}
`;

// Inject textLayer CSS once
let cssInjected = false;
function injectTextLayerCss() {
  if (cssInjected) return;
  const style = document.createElement('style');
  style.textContent = TEXT_LAYER_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// Lazy-load pdf.js to avoid bundling 3MB upfront
let pdfjs: typeof import('pdfjs-dist') | null = null;
async function loadPdfJs() {
  if (pdfjs) return pdfjs;
  const mod = await import('pdfjs-dist');
  mod.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  pdfjs = mod;
  return mod;
}

export type PageLayoutMode = 'single' | 'continuous';

interface PdfViewerProps {
  file: File | Blob | null;
  currentPage: number;
  zoom: number;
  layoutMode: PageLayoutMode;
  textSelectable: boolean; // true = show text layer for select/copy
  onPageChange: (page: number) => void;
  onTotalPagesChange: (total: number) => void;
  onError: (message: string) => void;
  onDocLoaded?: (doc: PDFDocumentProxy | null) => void;
  /** Click on the page stage; coords are document points, top-left origin */
  onStageClick?: (docX: number, docY: number) => void;
  /** Overlays rendered inside the page stage, sharing the canvas origin */
  children?: React.ReactNode;
}

export function PdfViewer({
  file,
  currentPage,
  zoom,
  layoutMode: _layoutMode,
  textSelectable,
  onPageChange: _onPageChange,
  onTotalPagesChange,
  onError,
  onDocLoaded,
  onStageClick,
  children,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const renderTaskRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const lib = await loadPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const doc = await lib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdfDoc(doc);
        onTotalPagesChange(doc.numPages);
        onDocLoaded?.(doc);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Khong the mo file PDF nay.';
        setError(msg);
        onError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Render current page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    if (pageNum < 1 || pageNum > pdfDoc.numPages) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const scale = zoom / 100;
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = viewport.width * window.devicePixelRatio;
      canvas.height = viewport.height * window.devicePixelRatio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      // Stage size drives overlay container dimensions (CSS px = points * scale)
      setStageSize({ width: viewport.width, height: viewport.height });

      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Render text layer for selection
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
        textLayerRef.current.style.width = `${viewport.width}px`;
        textLayerRef.current.style.height = `${viewport.height}px`;

        if (textSelectable) {
          injectTextLayerCss();
          const textContent = await page.getTextContent();
          const lib = await loadPdfJs();
          if (lib.TextLayer) {
            const textLayer = new lib.TextLayer({
              textContentSource: textContent,
              container: textLayerRef.current,
              viewport,
            });
            await textLayer.render();

            // Reverse the paint/hit stacking so earlier lines sit ON TOP of later
            // ones. When a line's enlarged bottom hit area overlaps the next line,
            // the current line wins hit-testing → its padding-bottom is effective.
            // DOM order is untouched, so selection text order and copy stay correct.
            const spans = textLayerRef.current.querySelectorAll('span');
            const n = spans.length;
            spans.forEach((span, i) => {
              (span as HTMLElement).style.zIndex = String(n - i);
            });
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PdfViewer] Render failed for page', pageNum, err);
    }
  }, [pdfDoc, zoom, textSelectable]);

  // Debounce render on page/zoom change
  useEffect(() => {
    if (!pdfDoc) return;
    if (renderTaskRef.current) clearTimeout(renderTaskRef.current);
    renderTaskRef.current = setTimeout(() => {
      renderPage(currentPage);
    }, 50);
    return () => {
      if (renderTaskRef.current) clearTimeout(renderTaskRef.current);
    };
  }, [pdfDoc, currentPage, zoom, renderPage]);

  // Keyboard zoom/navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        // Zoom handled by parent via onZoomChange
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <LoadingState variant="skeleton" count={1} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30 p-8">
        <ErrorState message={error} onRetry={() => { /* reload handled by parent */ }} />
      </div>
    );
  }

  if (!file || !pdfDoc) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Upload mot file PDF de bat dau.</p>
      </div>
    );
  }

  const handleStageClick = (e: React.MouseEvent) => {
    if (!onStageClick || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const scale = zoom / 100;
    const docX = (e.clientX - rect.left) / scale;
    const docY = (e.clientY - rect.top) / scale;
    onStageClick(docX, docY);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-muted/30 flex items-start justify-center p-4"
    >
      {/* Page stage: single positioned container shared by canvas + text layer + overlays */}
      <div
        ref={stageRef}
        className="relative shadow-md bg-white shrink-0"
        style={{ width: stageSize.width || undefined, height: stageSize.height || undefined }}
        onClick={handleStageClick}
      >
        <canvas ref={canvasRef} className="block" />
        <div
          ref={textLayerRef}
          className="absolute top-0 left-0 textLayer"
          style={{
            // KHÔNG ẩn textLayer (opacity 1 luôn) — user vẫn thấy text PDF ngay cả
            // khi thao tác object. Chỉ toggle pointer-events để không chặn overlay
            // pick object khi ở default state.
            pointerEvents: textSelectable ? 'auto' : 'none',
            opacity: 1,
            // pdf.js 4.x TextLayer requires --scale-factor to size/position spans
            ['--scale-factor' as string]: String(zoom / 100),
          }}
        />
        {/* Overlays share exact origin/scale with canvas */}
        {children}
      </div>
    </div>
  );
}
