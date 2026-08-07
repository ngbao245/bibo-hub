// ============================================================
// PDF Studio — Add Watermark workspace (all pages + responsive)
// ============================================================
// Left: form (text/position/opacity/rotation).
// Right: scrollable list, mỗi trang 1 canvas preview với watermark overlay
// live. Canvas co giãn theo container width qua ResizeObserver.
// Cùng hàm `renderWatermarkOnCanvas` với export → WYSIWYG.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Stamp, Download } from 'lucide-react';
import { LoadingState, ErrorState } from '@/components/shared';
import { addWatermarkPdf } from '../lib/operations';
import { renderWatermarkOnCanvas } from '../lib/watermark-render';
import { WorkspaceHeader } from './WorkspaceHeader';

interface WatermarkPdfWorkspaceProps {
  onBack: () => void;
}

// Offscreen page render scale — trade-off giữa clarity + speed.
// 1.5x cho ảnh sắc nhưng không nặng cho PDF nhiều trang.
const OFFSCREEN_SCALE = 1.5;

export function WatermarkPdfWorkspace({ onBack }: WatermarkPdfWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('CONFIDENTIAL');
  const [position, setPosition] = useState<'center' | 'bottom' | 'top'>('center');
  const [opacity, setOpacity] = useState(50);
  const [rotation, setRotation] = useState(45);
  const [tileMode, setTileMode] = useState(false);
  const [tileGap, setTileGap] = useState(40);
  const [tileGapX, setTileGapX] = useState(40);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('system-ui');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [containerWidth, setContainerWidth] = useState(600);

  // Offscreen cache — render 1 lần / file, redraw preview canvases chỉ cần
  // drawImage + watermark overlay (cheap).
  const pageImagesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const previewCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

  const options = { text, position, opacity, rotation, tile: tileMode, tileGap, tileGapX, fontSize, fontFamily };

  // ─── Responsive container width ─────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      // Trừ padding 2*16 = 32px
      const w = el.clientWidth - 32;
      setContainerWidth(Math.max(240, w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Load all pages offscreen ───────────────────────────────
  const loadAllPages = useCallback(async (f: File) => {
    setLoading(true);
    pageImagesRef.current.clear();
    previewCanvasRefs.current.clear();
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

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
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

  // ─── Redraw all preview canvases ────────────────────────────
  const redrawAll = useCallback(() => {
    for (const [pageNum, dst] of previewCanvasRefs.current.entries()) {
      const src = pageImagesRef.current.get(pageNum);
      if (!src || !dst) continue;
      const targetW = Math.min(containerWidth, src.width);
      const scale = targetW / src.width;
      const targetH = src.height * scale;
      dst.width = targetW;
      dst.height = targetH;
      const ctx = dst.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(src, 0, 0, targetW, targetH);
      renderWatermarkOnCanvas(ctx, options, targetW, targetH);
    }
  }, [options, containerWidth]);

  // Ref giữ redrawAll mới nhất — dùng trong .then() sau load để không
  // phải cho redrawAll vào deps của load effect (gây reload liên hồi khi
  // opacity/rotation slider đổi).
  const redrawAllRef = useRef(redrawAll);
  useEffect(() => {
    redrawAllRef.current = redrawAll;
  }, [redrawAll]);

  useEffect(() => {
    if (!file) {
      pageImagesRef.current.clear();
      previewCanvasRefs.current.clear();
      setTotalPages(0);
      return;
    }
    loadAllPages(file).then(() => redrawAllRef.current());
  }, [file, loadAllPages]);

  useEffect(() => {
    redrawAll();
  }, [redrawAll]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pdf = Array.from(e.target.files ?? []).find((f) =>
      f.name.toLowerCase().endsWith('.pdf'),
    );
    if (pdf) {
      setFile(pdf);
      setResult(null);
      setError(null);
    }
    e.target.value = '';
  };

  const handleApply = async () => {
    if (!file || !text.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await addWatermarkPdf(file, options);
      setResult(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm watermark thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace(/\.pdf$/i, '-watermarked.pdf') : 'watermarked.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        icon={Stamp}
        title="Thêm Watermark"
        subtitle={file ? `${totalPages} trang` : 'Preview mọi trang, WYSIWYG với export'}
        onBack={onBack}
        toolbarActions={undefined}
        primaryAction={
          result
            ? {
                icon: Download,
                label: 'Tải PDF',
                onClick: handleDownload,
              }
            : file
              ? {
                  icon: Download,
                  label: 'Lưu PDF',
                  onClick: handleApply,
                  disabled: !text.trim() || isProcessing,
                  loading: isProcessing,
                }
              : undefined
        }
      />

      {!file && (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 transition-[color,background-color,border-color] duration-150 ease-in-out hover:border-primary/50 hover:bg-muted/30">
          <Stamp className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-foreground">Click để chọn PDF</span>
          <input type="file" accept=".pdf" className="sr-only" onChange={handleFiles} />
        </label>
      )}

      {file && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* ─── Left: controls (sticky) ─── */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-border/60 bg-card p-3 text-sm elev-surface">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB · {totalPages} trang
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Text</label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="VD: BẢN MẬT, DRAFT..."
                className="h-9 w-full rounded border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Font</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="system-ui">System UI</option>
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Size</label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Vi tri</label>
              <div className="flex gap-1">
                {([['top', 'Tren'], ['center', 'Giua'], ['bottom', 'Duoi'], ['tile', 'Lap toan trang']] as const).map(
                  ([pos, label]) => (
                    <button
                      key={pos}
                      onClick={() => {
                        if (pos === 'tile') {
                          setTileMode(true);
                        } else {
                          setTileMode(false);
                          setPosition(pos as 'top' | 'center' | 'bottom');
                        }
                      }}
                      className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                        (pos === 'tile' && tileMode) || (pos !== 'tile' && !tileMode && position === pos)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-foreground/10'
                      }`}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </div>

            {tileMode && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Khoang cach doc</label>
                  <ClampedInput value={tileGap} min={-100} max={200} onChange={setTileGap} suffix="px" />
                </div>
                <input
                  type="range"
                  min="-100"
                  max="200"
                  value={tileGap}
                  onChange={(e) => setTileGap(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            {tileMode && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Khoang cach ngang</label>
                  <ClampedInput value={tileGapX} min={-100} max={300} onChange={setTileGapX} suffix="px" />
                </div>
                <input
                  type="range"
                  min="-100"
                  max="300"
                  value={tileGapX}
                  onChange={(e) => setTileGapX(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Do mo</label>
                <ClampedInput value={opacity} min={10} max={100} onChange={setOpacity} suffix="%" />
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Goc xoay</label>
                <ClampedInput value={rotation} min={0} max={360} onChange={setRotation} suffix="°" />
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {isProcessing && <LoadingState variant="inline" label="Đang xử lý..." />}
            {error && <ErrorState compact message={error} />}

            {result && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
                <p className="font-medium text-success">Xong — tất cả trang đã có watermark</p>
              </div>
            )}
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
                            // Trigger redraw once ref attached
                            requestAnimationFrame(() => redrawAll());
                          }
                        }}
                        className="rounded"
                        style={{ display: 'block', maxWidth: '100%' }}
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


// ─── ClampedInput: click-to-edit inline value ────────────────

function ClampedInput({
  value,
  min,
  max,
  onChange,
  suffix = '',
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const num = Number(draft);
    if (!isNaN(num)) {
      onChange(Math.min(max, Math.max(min, num)));
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-5 w-14 rounded border border-ring bg-background px-1 text-right text-xs tabular-nums text-foreground outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      className="h-5 cursor-text rounded px-1 text-right text-xs tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {value}{suffix}
    </button>
  );
}
