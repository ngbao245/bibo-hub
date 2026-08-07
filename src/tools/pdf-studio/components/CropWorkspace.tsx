// ============================================================
// PDF Studio — Crop workspace (all pages + responsive + drag)
// ============================================================
// Left: 4 margin inputs (pt).
// Right: scrollable list mọi trang, mỗi trang canvas với dark overlay
// vùng bỏ + handle draggable 4 cạnh. Drag trên bất kỳ trang nào update
// margins global. Canvas co giãn theo container qua ResizeObserver.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Crop, Download, RefreshCw, BookOpen, Square, Circle } from 'lucide-react';
import { LoadingState, ErrorState } from '@/components/shared';
import { DropZone } from './DropZone';
import { cropPdf, type CropMargins } from '../lib/operations';
import { usePdfStudioStore } from '../store';
import { ToolbarButton, ToolbarSeparator } from './WorkspaceToolbar';
import { WorkspaceHeader } from './WorkspaceHeader';

interface CropWorkspaceProps {
  onBack: () => void;
}

const OFFSCREEN_SCALE = 1.5;
const DRAG_THRESHOLD_PX = 14;

type DragSide = 'top' | 'right' | 'bottom' | 'left' | null;

export function CropWorkspace({ onBack }: CropWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [basePagePt, setBasePagePt] = useState({ w: 0, h: 0 });
  const [margins, setMargins] = useState<CropMargins>({ top: 20, right: 20, bottom: 20, left: 20 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [containerWidth, setContainerWidth] = useState(600);
  const [dragging, setDragging] = useState<DragSide>(null);
  const [hoverSide, setHoverSide] = useState<DragSide>(null);

  const pageImagesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const previewCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageDimsRef = useRef<Map<number, { w: number; h: number }>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ─── Responsive width ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - 32;
      setContainerWidth(Math.max(240, w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleFiles = (files: File[]) => {
    const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdf) {
      setFile(pdf);
      setResult(null);
      setError(null);
    }
  };

  // ─── Load all pages ─────────────────────────────────────────
  const loadAllPages = useCallback(async (f: File) => {
    setLoading(true);
    pageImagesRef.current.clear();
    previewCanvasRefs.current.clear();
    pageDimsRef.current.clear();
    try {
      const pdfjs = await import('pdfjs-dist');
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
      }
      const ab = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: ab }).promise;
      setTotalPages(doc.numPages);

      let firstSet = false;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const basePt = page.getViewport({ scale: 1 });
        pageDimsRef.current.set(i, { w: basePt.width, h: basePt.height });
        if (!firstSet) {
          setBasePagePt({ w: basePt.width, h: basePt.height });
          firstSet = true;
        }
        const vp = page.getViewport({ scale: OFFSCREEN_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        pageImagesRef.current.set(i, canvas);
      }
      doc.destroy();
    } catch {
      pageImagesRef.current.clear();
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Redraw ────────────────────────────────────────────────
  const redrawAll = useCallback(() => {
    for (const [pageNum, dst] of previewCanvasRefs.current.entries()) {
      const src = pageImagesRef.current.get(pageNum);
      const pt = pageDimsRef.current.get(pageNum);
      if (!src || !dst || !pt) continue;
      const targetW = Math.min(containerWidth, src.width);
      const scale = targetW / src.width;
      const targetH = src.height * scale;
      dst.width = targetW;
      dst.height = targetH;
      const ctx = dst.getContext('2d');
      if (!ctx) continue;

      ctx.drawImage(src, 0, 0, targetW, targetH);

      // Overlay margins — px per pt cho canvas này
      const pxPerPt = targetW / pt.w;
      const mx = {
        top: margins.top * pxPerPt,
        right: margins.right * pxPerPt,
        bottom: margins.bottom * pxPerPt,
        left: margins.left * pxPerPt,
      };

      // Dark bands ngoài crop
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(0, 0, targetW, mx.top);
      ctx.fillRect(0, targetH - mx.bottom, targetW, mx.bottom);
      ctx.fillRect(0, mx.top, mx.left, targetH - mx.top - mx.bottom);
      ctx.fillRect(targetW - mx.right, mx.top, mx.right, targetH - mx.top - mx.bottom);

      // Border
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        mx.left,
        mx.top,
        targetW - mx.left - mx.right,
        targetH - mx.top - mx.bottom,
      );

      // Handles 4 cạnh
      const drawHandle = (cx: number, cy: number, active: boolean) => {
        const size = active ? 16 : 12;
        ctx.fillStyle = active ? 'rgba(59, 130, 246, 1)' : 'rgba(59, 130, 246, 0.9)';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
        ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
      };
      const midX = mx.left + (targetW - mx.left - mx.right) / 2;
      const midY = mx.top + (targetH - mx.top - mx.bottom) / 2;
      drawHandle(midX, mx.top, dragging === 'top' || hoverSide === 'top');
      drawHandle(midX, targetH - mx.bottom, dragging === 'bottom' || hoverSide === 'bottom');
      drawHandle(mx.left, midY, dragging === 'left' || hoverSide === 'left');
      drawHandle(targetW - mx.right, midY, dragging === 'right' || hoverSide === 'right');
    }
  }, [margins, containerWidth, dragging, hoverSide]);

  // Ref giữ redrawAll mới nhất — dùng trong .then() sau load để không
  // phải cho redrawAll vào deps của load effect (gây reload liên hồi khi
  // hoverSide đổi qua mouse move).
  const redrawAllRef = useRef(redrawAll);
  useEffect(() => {
    redrawAllRef.current = redrawAll;
  }, [redrawAll]);

  useEffect(() => {
    if (!file) return;
    loadAllPages(file).then(() => redrawAllRef.current());
  }, [file, loadAllPages]);

  useEffect(() => {
    redrawAll();
  }, [redrawAll]);

  // ─── Drag handling (any page) ───────────────────────────────
  const pointerToCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      w: canvas.width,
      h: canvas.height,
    };
  };

  const getPageNumFromCanvas = (canvas: HTMLCanvasElement): number | null => {
    for (const [pageNum, ref] of previewCanvasRefs.current.entries()) {
      if (ref === canvas) return pageNum;
    }
    return null;
  };

  const detectSide = (
    p: { x: number; y: number; w: number; h: number },
    pxPerPt: number,
  ): DragSide => {
    const mx = {
      top: margins.top * pxPerPt,
      right: margins.right * pxPerPt,
      bottom: margins.bottom * pxPerPt,
      left: margins.left * pxPerPt,
    };
    if (Math.abs(p.y - mx.top) < DRAG_THRESHOLD_PX) return 'top';
    if (Math.abs(p.y - (p.h - mx.bottom)) < DRAG_THRESHOLD_PX) return 'bottom';
    if (Math.abs(p.x - mx.left) < DRAG_THRESHOLD_PX) return 'left';
    if (Math.abs(p.x - (p.w - mx.right)) < DRAG_THRESHOLD_PX) return 'right';
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const pageNum = getPageNumFromCanvas(canvas);
    if (!pageNum) return;
    const pt = pageDimsRef.current.get(pageNum);
    if (!pt) return;
    const p = pointerToCanvas(e);
    const pxPerPt = p.w / pt.w;
    const side = detectSide(p, pxPerPt);
    if (side) {
      setDragging(side);
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const pageNum = getPageNumFromCanvas(canvas);
    if (!pageNum) return;
    const pt = pageDimsRef.current.get(pageNum);
    if (!pt) return;
    const p = pointerToCanvas(e);
    const pxPerPt = p.w / pt.w;

    if (!dragging) {
      setHoverSide(detectSide(p, pxPerPt));
      return;
    }

    setMargins((prev) => {
      const next = { ...prev };
      const maxH = pt.h / 2;
      const maxW = pt.w / 2;
      switch (dragging) {
        case 'top':
          next.top = Math.max(0, Math.min(p.y / pxPerPt, maxH));
          break;
        case 'bottom':
          next.bottom = Math.max(0, Math.min((p.h - p.y) / pxPerPt, maxH));
          break;
        case 'left':
          next.left = Math.max(0, Math.min(p.x / pxPerPt, maxW));
          break;
        case 'right':
          next.right = Math.max(0, Math.min((p.w - p.x) / pxPerPt, maxW));
          break;
      }
      return next;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setDragging(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const cursorClass = dragging || hoverSide
    ? (dragging || hoverSide) === 'top' || (dragging || hoverSide) === 'bottom'
      ? 'cursor-ns-resize'
      : 'cursor-ew-resize'
    : 'cursor-default';

  const updateMarginInput = (side: keyof CropMargins, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setMargins((prev) => ({ ...prev, [side]: num }));
    }
  };

  const handleCrop = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await cropPdf(file, margins);
      setResult(blob);
      const outName = file.name.replace(/\.pdf$/i, '_cropped.pdf');
      usePdfStudioStore.getState().openInEditor(blob, outName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cắt xén thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace(/\.pdf$/i, '-cropped.pdf') : 'cropped.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        icon={Crop}
        title="Cắt xén PDF"
        subtitle={file ? `${totalPages} trang` : 'Kéo cạnh để chỉnh margin'}
        onBack={onBack}
        toolbarActions={
          file ? (
            <>
              <ToolbarButton
                icon={Square}
                label="Không margin"
                onClick={() => setMargins({ top: 0, right: 0, bottom: 0, left: 0 })}
              />
              <ToolbarButton
                icon={BookOpen}
                label="Book (36pt)"
                onClick={() => setMargins({ top: 36, right: 36, bottom: 36, left: 36 })}
              />
              <ToolbarButton
                icon={Circle}
                label="Wide (72pt)"
                onClick={() => setMargins({ top: 72, right: 72, bottom: 72, left: 72 })}
              />
              <ToolbarSeparator />
              <ToolbarButton
                icon={RefreshCw}
                label="Reset"
                onClick={() => setMargins({ top: 20, right: 20, bottom: 20, left: 20 })}
              />
            </>
          ) : undefined
        }
        primaryAction={
          result
            ? {
                icon: Download,
                label: 'Tải file',
                onClick: handleDownload,
              }
            : file
              ? {
                  icon: Download,
                  label: 'Lưu PDF',
                  onClick: handleCrop,
                  disabled: isProcessing,
                  loading: isProcessing,
                }
              : undefined
        }
      />

      {!file && <DropZone onFiles={handleFiles} maxFiles={1} />}

      {file && (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* ─── Left: inputs (sticky) ─── */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-border/60 bg-card p-3 text-sm elev-surface">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {totalPages} trang · {basePagePt.w.toFixed(0)}×{basePagePt.h.toFixed(0)}pt
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Margins (pt)</p>
              {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                <div key={side} className="flex items-center gap-2">
                  <span className="w-14 text-xs capitalize text-muted-foreground">
                    {side === 'top'
                      ? 'Trên'
                      : side === 'right'
                        ? 'Phải'
                        : side === 'bottom'
                          ? 'Dưới'
                          : 'Trái'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={Math.round(margins[side])}
                    onChange={(e) => updateMarginInput(side, e.target.value)}
                    onKeyDown={(e) => {
                      // Prevent arrow keys from scrolling outer container
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.stopPropagation();
                      }
                    }}
                    className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="w-4 text-[10px] text-muted-foreground">pt</span>
                </div>
              ))}
            </div>

            {isProcessing && <LoadingState variant="inline" label="Đang cắt..." />}
            {error && <ErrorState compact message={error} />}

            {result && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
                <p className="font-medium text-success">Cắt xén xong</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              72pt = 1 inch. Margins áp cho mọi trang.
            </p>
          </div>

          {/* ─── Right: scrollable multi-page preview ─── */}
          <div
            ref={containerRef}
            className="max-h-[80vh] overflow-y-auto rounded-xl border border-border/60 bg-muted/30 p-4 elev-surface"
          >
            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <LoadingState label={`Đang tải ${totalPages || 'preview'}...`} />
              </div>
            ) : totalPages === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Không đọc được PDF</p>
            ) : (
              <div className="space-y-6">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <div key={pageNum} className="flex flex-col items-center gap-1.5">
                      <canvas
                        ref={(el) => {
                          if (el) {
                            previewCanvasRefs.current.set(pageNum, el);
                            requestAnimationFrame(() => redrawAll());
                          }
                        }}
                        className={`rounded touch-none ${cursorClass}`}
                        style={{ display: 'block', maxWidth: '100%' }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onPointerLeave={() => setHoverSide(null)}
                      />
                      <span className="text-xs text-muted-foreground">
                        Trang {pageNum} / {totalPages}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
