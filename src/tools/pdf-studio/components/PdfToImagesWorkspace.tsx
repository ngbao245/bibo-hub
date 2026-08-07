// ============================================================
// PDF Studio — PDF → Images workspace (thumbnail preview + format/scale)
// ============================================================
// Preview: grid thumbnails render bằng pdf.js — user thấy trước khi export.
// Format: PNG (lossless) hoặc JPG (nhỏ hơn).
// Scale: 1x-3x tương ứng 72-216 DPI.
// Nhiều trang → download ZIP. 1 trang → download image trực tiếp.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Image as ImageIcon, Download, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { LoadingState, ErrorState } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { DropZone } from './DropZone';
import { pdfToImages } from '../lib/operations';
import { ToolbarButton, ToolbarSeparator } from './WorkspaceToolbar';
import { WorkspaceHeader } from './WorkspaceHeader';

interface PdfToImagesWorkspaceProps {
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

export function PdfToImagesWorkspace({ onBack }: PdfToImagesWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(92);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState<number>(DEFAULT_ZOOM_INDEX);
  const thumbMinWidth = THUMB_SIZES[zoomIndex];
  const zoomIn = () => setZoomIndex((i) => Math.min(THUMB_SIZES.length - 1, i + 1));
  const zoomOut = () => setZoomIndex((i) => Math.max(0, i - 1));
  const pdfRef = useRef<PdfDoc | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const handleFiles = (files: File[]) => {
    const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) return;
    setFile(pdf);
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

  const renderThumb = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
    const doc = pdfRef.current;
    if (!doc) return;
    try {
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const s = (THUMB_SIZES[THUMB_SIZES.length - 1] * 2) / base.width;
      const vp = page.getViewport({ scale: s });
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    } catch {
      /* ignore */
    }
  }, []);

  const handleExport = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await pdfToImages(file, {
        format,
        scale,
        quality: quality / 100,
      });
      setResult(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Convert thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !file) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    const isZip = result.type.includes('zip');
    const baseName = file.name.replace(/\.pdf$/i, '');
    a.download = isZip ? `${baseName}-images.zip` : `${baseName}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        icon={ImageIcon}
        title="PDF → Ảnh"
        subtitle={file ? `${totalPages} trang` : 'Render mỗi trang thành PNG/JPG'}
        onBack={onBack}
        toolbarActions={
          file ? (
            <>
              <ToolbarButton
                icon={ImageIcon}
                label="PNG"
                active={format === 'png'}
                onClick={() => setFormat('png')}
              />
              <ToolbarButton
                icon={ImageIcon}
                label="JPG"
                active={format === 'jpg'}
                onClick={() => setFormat('jpg')}
              />
              <ToolbarSeparator />
              <ToolbarButton
                icon={ImageIcon}
                label="Nhỏ"
                active={scale === 1}
                onClick={() => setScale(1)}
                title="1x — 72 DPI"
              />
              <ToolbarButton
                icon={ImageIcon}
                label="Chuẩn"
                active={scale === 2}
                onClick={() => setScale(2)}
                title="2x — 144 DPI"
              />
              <ToolbarButton
                icon={ImageIcon}
                label="Sắc nét"
                active={scale === 3}
                onClick={() => setScale(3)}
                title="3x — 216 DPI"
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
                label: `Tải ${result.type.includes('zip') ? 'ZIP' : format.toUpperCase()}`,
                onClick: handleDownload,
              }
            : file
              ? {
                  icon: Check,
                  label: `Export ${totalPages} trang`,
                  onClick: handleExport,
                  disabled: isProcessing || totalPages === 0,
                  loading: isProcessing,
                }
              : undefined
        }
      />

      {!file && <DropZone onFiles={handleFiles} maxFiles={1} />}

      {file && (
        <div className="space-y-3">
          {format === 'jpg' && (
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs elev-surface">
              <span className="font-medium text-muted-foreground">JPG Quality:</span>
              <input
                type="range"
                min="50"
                max="100"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="flex-1 max-w-xs"
              />
              <span className="w-10 tabular-nums text-muted-foreground">{quality}%</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {totalPages} trang → {totalPages === 1 ? `1 ${format.toUpperCase()}` : 'ZIP'}
          </p>

          {/* Preview thumbnails */}
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
                return (
                  <div key={pageNum} className="relative w-full rounded border border-border">
                    <canvas
                      ref={(el) => {
                        if (el) {
                          canvasRefs.current.set(pageNum, el);
                          renderThumb(pageNum, el);
                        }
                      }}
                      className="rounded"
                      style={{ width: '100%', display: 'block' }}
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 text-[10px] text-foreground">
                      {pageNum}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {isProcessing && <LoadingState variant="inline" label="Đang convert..." />}
          {error && <ErrorState compact message={error} />}

          {result && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">
                Convert xong — {(result.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
