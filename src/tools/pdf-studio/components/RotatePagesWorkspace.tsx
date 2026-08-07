// ============================================================
// PDF Studio — Rotate pages workspace (live per-page rotation)
// ============================================================
// Thumbnails grid với nút xoay 90° trên mỗi trang.
// Rotation live via CSS transform → user thấy ngay góc mới.
// Apply thật khi bấm Xoay: pdf-lib setRotation cho từng trang.
// ============================================================

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  RotateCw,
  RotateCcw,
  Download,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Check,
  Undo2,
  Redo2,
} from 'lucide-react';
import { LoadingState, ErrorState } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { DropZone } from './DropZone';
import { rotatePdfPages, type RotateSpec } from '../lib/operations';
import { usePdfStudioStore } from '../store';
import { ToolbarButton, ToolbarSeparator } from './WorkspaceToolbar';
import { WorkspaceHeader } from './WorkspaceHeader';
import { cn } from '@/lib/cn';
import { getRotationStyle } from '../lib/rotation-style';
import { useHistoryState } from '../lib/use-history-state';

interface RotatePagesWorkspaceProps {
  onBack: () => void;
}

const THUMB_SIZES = [180, 240, 300, 360, 420] as const;
const DEFAULT_ZOOM_INDEX = 1;

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: unknown) => { promise: Promise<void> };
  }>;
  destroy: () => void;
};

export function RotatePagesWorkspace({ onBack }: RotatePagesWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const {
    state: rotations,
    commit: commitRotations,
    reset: resetRotations,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistoryState<Map<number, number>>(new Map(), {
    cloneFn: (v) => new Map(v),
  });
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState<number>(DEFAULT_ZOOM_INDEX);
  const thumbMinWidth = THUMB_SIZES[zoomIndex];
  const pdfRef = useRef<PdfDoc | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const zoomIn = () => setZoomIndex((i) => Math.min(THUMB_SIZES.length - 1, i + 1));
  const zoomOut = () => setZoomIndex((i) => Math.max(0, i - 1));

  const handleFiles = (files: File[]) => {
    const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) return;
    setFile(pdf);
    resetRotations(new Map());
    setResult(null);
    setError(null);
  };

  useEffect(() => {
    if (!file) return;
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
        const doc = (await pdfjs.getDocument({ data: ab }).promise) as unknown as PdfDoc;
        if (cancelled) {
          doc.destroy();
          return;
        }
        pdfRef.current = doc;
        setTotalPages(doc.numPages);
      } catch {
        setTotalPages(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const renderPageToCanvas = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
    const doc = pdfRef.current;
    if (!doc) return;
    try {
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const scale = (THUMB_SIZES[THUMB_SIZES.length - 1] * 2) / base.width;
      const vp = page.getViewport({ scale });
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    } catch {
      /* ignore */
    }
  }, []);

  // Rotations lưu góc CUMULATIVE (có thể âm hoặc > 360) để CSS transition
  // interpolate ngắn nhất theo hướng user bấm. Chỉ normalize khi apply
  // vào pdf-lib hoặc hiển thị badge số.
  const rotatePage = (pageNum: number, delta: 90 | -90) => {
    commitRotations((prev) => {
      const next = new Map(prev);
      const current = next.get(pageNum) ?? 0;
      next.set(pageNum, current + delta);
      return next;
    });
  };

  const rotateAll = (delta: 90 | -90) => {
    commitRotations((prev) => {
      const next = new Map<number, number>(prev);
      for (let i = 1; i <= totalPages; i++) {
        next.set(i, (next.get(i) ?? 0) + delta);
      }
      return next;
    });
  };

  // Reset: snap mỗi rawAngle về multiple of 360 gần nhất → CSS transition
  // đi đường ngắn nhất về visual 0°. Không clear map để tránh CSS nhảy
  // rotate(0deg) đột ngột từ ±360; multiple-of-360 mapped equivalent 0.
  const resetAll = () =>
    commitRotations((prev) => {
      const next = new Map<number, number>();
      for (const [page, angle] of prev.entries()) {
        const nearestZero = Math.round(angle / 360) * 360;
        next.set(page, nearestZero);
      }
      return next;
    });

  // Normalize 0-359 cho pdf-lib + hiển thị. Loại page có góc effective = 0.
  const normalizedRotations = useMemo(() => {
    const map = new Map<number, number>();
    for (const [page, angle] of rotations.entries()) {
      const normalized = (((angle % 360) + 360) % 360);
      if (normalized !== 0) map.set(page, normalized);
    }
    return map;
  }, [rotations]);

  const handleApply = async () => {
    if (!file || normalizedRotations.size === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const specs: RotateSpec[] = Array.from(normalizedRotations.entries()).map(
        ([page, angle]) => ({ page, angle }),
      );
      const blob = await rotatePdfPages(file, specs);
      setResult(blob);
      const outName = file.name.replace(/\.pdf$/i, '_rotated.pdf');
      usePdfStudioStore.getState().openInEditor(blob, outName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xoay thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !file) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.pdf$/i, '-rotated.pdf');
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        icon={RotateCw}
        title="Xoay trang"
        subtitle={file ? `${totalPages} trang` : 'Click nút xoay trên mỗi trang'}
        onBack={onBack}
        toolbarActions={
          file ? (
            <>
              <ToolbarButton
                icon={RotateCcw}
                label="Xoay trái tất cả"
                onClick={() => rotateAll(-90)}
              />
              <ToolbarButton
                icon={RotateCw}
                label="Xoay phải tất cả"
                onClick={() => rotateAll(90)}
              />
              <ToolbarButton
                icon={RefreshCw}
                label="Reset"
                onClick={resetAll}
                disabled={normalizedRotations.size === 0}
              />
              <ToolbarSeparator />
              <ToolbarButton
                icon={Undo2}
                label="Hoàn tác"
                onClick={undo}
                disabled={!canUndo}
              />
              <ToolbarButton
                icon={Redo2}
                label="Làm lại"
                onClick={redo}
                disabled={!canRedo}
              />
              <ToolbarSeparator />
              <ToolbarButton
                icon={ZoomOut}
                label="Thu nhỏ"
                onClick={zoomOut}
                disabled={zoomIndex === 0}
              />
              <ToolbarButton
                icon={ZoomIn}
                label="Phóng to"
                onClick={zoomIn}
                disabled={zoomIndex === THUMB_SIZES.length - 1}
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
                  icon: Check,
                  label: `Áp dụng (${normalizedRotations.size})`,
                  onClick: handleApply,
                  disabled: normalizedRotations.size === 0 || isProcessing,
                  loading: isProcessing,
                }
              : undefined
        }
      />

      {!file && <DropZone onFiles={handleFiles} maxFiles={1} />}

      {file && (
        <div className="space-y-3">
          {loading && (
            <div
              className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 elev-surface"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbMinWidth}px, 1fr))` }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[220px] w-full rounded" />
              ))}
            </div>
          )}

          {!loading && totalPages > 0 && (
            <div
              className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 elev-surface"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbMinWidth}px, 1fr))` }}
            >
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                // rawAngle: cumulative (có thể âm/> 360) — dùng cho CSS transition
                //   để interpolate ngắn nhất theo chiều user bấm
                // displayAngle: normalize 0-359 — hiển thị badge cho user
                const rawAngle = rotations.get(pageNum) ?? 0;
                const displayAngle = (((rawAngle % 360) + 360) % 360);
                const isRotated = displayAngle !== 0;
                return (
                  <div key={pageNum} className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        'relative w-full overflow-hidden rounded border-2 transition-colors',
                        isRotated ? 'border-primary' : 'border-border',
                      )}
                    >
                      <canvas
                        ref={(el) => {
                          if (el) {
                            canvasRefs.current.set(pageNum, el);
                            renderPageToCanvas(pageNum, el);
                          }
                        }}
                        className="rounded"
                        style={getRotationStyle(rawAngle, {
                          width: '100%',
                          display: 'block',
                        })}
                      />
                      <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 text-[10px] text-foreground">
                        {pageNum}
                        {isRotated && <span className="ml-1 text-primary">{displayAngle}°</span>}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => rotatePage(pageNum, -90)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Trang ${pageNum}: xoay -90°`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => rotatePage(pageNum, 90)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Trang ${pageNum}: xoay +90°`}
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isProcessing && <LoadingState variant="inline" label="Đang xoay..." />}
          {error && <ErrorState compact message={error} />}

          {result && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">
                Xoay xong — {normalizedRotations.size} trang đã áp
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
