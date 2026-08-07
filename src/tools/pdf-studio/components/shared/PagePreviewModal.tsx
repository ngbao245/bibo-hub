// ============================================================
// PDF Studio Shared — Page preview modal (high-res + zoom + pan)
// ============================================================
// Render page from SOURCE PDF at high scale (2x-3x viewport) → CSS zoom
// giữ chữ sharp thay vì upscale thumbnail nhỏ.
// - Zoom in/out buttons + reset
// - Wheel: zoom quanh cursor (không có scroll dọc — modal 1 trang)
// - Drag to pan (clamped để không kéo PDF ra ngoài viewport)
// - Close: X button, Escape key, click backdrop
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface PagePreviewModalProps {
  /** Source PDF file/blob to render page from */
  file: File | Blob;
  /** 1-indexed page number */
  pageNum: number;
  /** Modal title (VD filename) */
  title: string;
  /** Modal subtitle (VD "N trang · Xoay 90°") */
  subtitle?: string;
  /** Rotation angle for CSS (raw cumulative OK) */
  rotation?: number;
  onClose: () => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.25;
// Render at high scale — canvas resolution 2.5x viewport target (crisp khi zoom in)
const RENDER_SCALE = 2.5;
// Padding cho pan bounds — user có thể kéo hơi past edge nhưng không đi hẳn
const PAN_PADDING = 80;

export function PagePreviewModal({
  file,
  pageNum,
  title,
  subtitle,
  rotation = 0,
  onClose,
}: PagePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render page từ source PDF ở scale cao (crisp)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const pdfjs = await import('pdfjs-dist');
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url,
          ).toString();
        }
        const ab = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: ab }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        const page = await doc.getPage(pageNum);
        const base = page.getViewport({ scale: 1 });
        const targetHeight = Math.min(window.innerHeight * 0.75, 900);
        const scale = (targetHeight / base.height) * RENDER_SCALE;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          doc.destroy();
          return;
        }
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        canvasRef.current = canvas;
        doc.destroy();
        setLoading(false);
      } catch {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, pageNum]);

  // Escape → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Measure canvas display size khi resize window
  useEffect(() => {
    const onResize = () => {
      const el = displayCanvasRef.current;
      if (el) setCanvasSize({ w: el.offsetWidth, h: el.offsetHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Clamp pan sao cho không kéo PDF ra khỏi viewport quá xa
  const clampPan = useCallback(
    (px: number, py: number, z: number): { x: number; y: number } => {
      const vp = viewportRef.current;
      if (!vp || canvasSize.w === 0) return { x: px, y: py };
      // Rotate 90/270 → chiều hiển thị swap
      const isRot90 = Math.abs(((rotation % 180) + 180) % 180) === 90;
      const dispW = isRot90 ? canvasSize.h : canvasSize.w;
      const dispH = isRot90 ? canvasSize.w : canvasSize.h;
      const scaledW = dispW * z;
      const scaledH = dispH * z;
      const maxX = Math.max(0, (scaledW - vp.clientWidth) / 2 + PAN_PADDING);
      const maxY = Math.max(0, (scaledH - vp.clientHeight) / 2 + PAN_PADDING);
      return {
        x: Math.max(-maxX, Math.min(maxX, px)),
        y: Math.max(-maxY, Math.min(maxY, py)),
      };
    },
    [canvasSize, rotation],
  );

  // Wheel = zoom quanh cursor
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((prev) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
        if (next === prev) return prev;
        const factor = next / prev;
        setPan((p) => {
          const rawX = cursorX - (cursorX - p.x) * factor;
          const rawY = cursorY - (cursorY - p.y) * factor;
          return clampPan(rawX, rawY, next);
        });
        return next;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [clampPan]);

  // Re-clamp pan khi zoom/rotation/canvasSize đổi (VD zoom out → pan trong bounds hẹp hơn)
  useEffect(() => {
    setPan((p) => clampPan(p.x, p.y, zoom));
  }, [zoom, canvasSize, rotation, clampPan]);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const rawX = dragging.panX + (e.clientX - dragging.startX);
    const rawY = dragging.panY + (e.clientY - dragging.startY);
    setPan(clampPan(rawX, rawY, zoom));
  };
  const handlePointerUp = () => setDragging(null);

  const zoomIn = () => {
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, z + ZOOM_STEP);
      setPan((p) => clampPan(p.x, p.y, next));
      return next;
    });
  };
  const zoomOut = () => {
    setZoom((z) => {
      const next = Math.max(MIN_ZOOM, z - ZOOM_STEP);
      setPan((p) => clampPan(p.x, p.y, next));
      return next;
    });
  };
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/70 px-4 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          {subtitle && <p className="truncate text-xs text-white/60">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-8 w-8 items-center justify-center rounded text-white transition-colors hover:bg-white/10 disabled:opacity-30"
            title="Thu nho (lan chuot xuong)"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="flex h-8 min-w-[64px] items-center justify-center gap-1 rounded px-2 text-xs tabular-nums text-white transition-colors hover:bg-white/10"
            title="Reset (100%)"
          >
            <Maximize2 className="h-3 w-3" />
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-8 w-8 items-center justify-center rounded text-white transition-colors hover:bg-white/10 disabled:opacity-30"
            title="Phong to (lan chuot len)"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Dong"
          title="Dong (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas viewport */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => e.stopPropagation()}
        style={{ cursor: dragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            Dang tai...
          </div>
        )}
        {!loading && (() => {
          const angle = ((rotation % 360) + 360) % 360;
          const isSideways = angle === 90 || angle === 270;
          const effectiveZoom = zoom * (isSideways ? 0.7071 : 1);
          return (
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${effectiveZoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: dragging ? 'none' : 'transform 180ms ease-out',
            }}
          >
            <canvas
              ref={(el) => {
                displayCanvasRef.current = el;
                if (el && canvasRef.current) {
                  const src = canvasRef.current;
                  el.width = src.width;
                  el.height = src.height;
                  const ctx = el.getContext('2d');
                  if (ctx) ctx.drawImage(src, 0, 0);
                  // Measure display size after mount (rAF chờ layout)
                  requestAnimationFrame(() => {
                    if (el) setCanvasSize({ w: el.offsetWidth, h: el.offsetHeight });
                  });
                }
              }}
              className="block rounded shadow-2xl"
              style={{
                maxWidth: '80vw',
                maxHeight: '75vh',
                display: 'block',
              }}
            />
          </div>
          );
        })()}
      </div>

      {/* Footer hint */}
      <div
        className="shrink-0 border-t border-white/10 bg-black/70 px-4 py-1.5 text-center text-[11px] text-white/60"
        onClick={(e) => e.stopPropagation()}
      >
        Lan chuot: zoom quanh cursor · Keo canvas: di chuyen · Esc: dong
      </div>
    </div>
  );
}
