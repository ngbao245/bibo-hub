// ============================================================
// PDF Studio — Compress workspace
// ============================================================
// Preset card với estimate range % + use case + quality trade-off.
// Smart recommend theo file size gốc (badge "Đề xuất").
// Sau nén: preview 2 canvas before/after + bar chart size compare.
// ============================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { Minimize2, Download, Zap, Scale, Feather, RotateCcw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LoadingState, ErrorState } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { DropZone } from './DropZone';
import { compressPdf, type CompressionLevel } from '../lib/operations';
import { WorkspaceHeader } from './WorkspaceHeader';
import { cn } from '@/lib/cn';

interface CompressWorkspaceProps {
  onBack: () => void;
}

interface PresetInfo {
  level: CompressionLevel;
  title: string;
  icon: LucideIcon;
  /** Dải kích thước còn lại so với gốc (VD 0.65 → còn 65% = giảm 35%) */
  minRatio: number;
  maxRatio: number;
  /** Use case ngắn */
  useCase: string;
  /** Quality trade-off note */
  qualityNote: string;
}

const PRESETS: PresetInfo[] = [
  {
    level: 'low',
    title: 'Nhẹ',
    icon: Feather,
    minRatio: 0.75,
    maxRatio: 0.85,
    useCase: 'In ấn, tài liệu chuyên môn',
    qualityNote: 'Giữ chất lượng gần như gốc',
  },
  {
    level: 'recommended',
    title: 'Vừa',
    icon: Scale,
    minRatio: 0.4,
    maxRatio: 0.6,
    useCase: 'Gửi email, xem trên màn hình',
    qualityNote: 'Chất lượng đọc tốt, ảnh nhẹ mờ',
  },
  {
    level: 'extreme',
    title: 'Mạnh',
    icon: Zap,
    minRatio: 0.2,
    maxRatio: 0.35,
    useCase: 'Upload web, share nhanh',
    qualityNote: 'Ảnh mờ rõ, text vẫn đọc được',
  },
];

/** Đề xuất level dựa vào file size gốc (MB). */
function getRecommendedLevel(sizeMb: number): CompressionLevel {
  if (sizeMb < 2) return 'low';
  if (sizeMb > 10) return 'extreme';
  return 'recommended';
}

async function renderFirstPage(file: File | Blob, width = 320): Promise<HTMLCanvasElement | null> {
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
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = width / base.width;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    if (ctx) await page.render({ canvasContext: ctx, viewport: vp }).promise;
    doc.destroy();
    return canvas;
  } catch {
    return null;
  }
}

export function CompressWorkspace({ onBack }: CompressWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<CompressionLevel>('recommended');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    blob: Blob;
    originalSize: number;
    compressedSize: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [originalThumb, setOriginalThumb] = useState<HTMLCanvasElement | null>(null);
  const [compressedThumb, setCompressedThumb] = useState<HTMLCanvasElement | null>(null);
  const [thumbLoading, setThumbLoading] = useState(false);

  const fileSizeMb = file ? file.size / 1024 / 1024 : 0;
  const recommendedLevel = useMemo(
    () => (file ? getRecommendedLevel(fileSizeMb) : null),
    [file, fileSizeMb],
  );

  // File change → set default level = recommended, render original thumb
  useEffect(() => {
    if (!file) {
      setOriginalThumb(null);
      setCompressedThumb(null);
      return;
    }
    if (recommendedLevel) setLevel(recommendedLevel);
    let cancelled = false;
    setThumbLoading(true);
    renderFirstPage(file).then((canvas) => {
      if (!cancelled) {
        setOriginalThumb(canvas);
        setThumbLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [file, recommendedLevel]);

  // Compressed blob change → render compressed thumb
  useEffect(() => {
    if (!result) {
      setCompressedThumb(null);
      return;
    }
    let cancelled = false;
    renderFirstPage(result.blob).then((canvas) => {
      if (!cancelled) setCompressedThumb(canvas);
    });
    return () => {
      cancelled = true;
    };
  }, [result]);

  const handleFiles = (files: File[]) => {
    const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdf) {
      setFile(pdf);
      setResult(null);
      setError(null);
    }
  };

  const handleLevelChange = (newLevel: CompressionLevel) => {
    setLevel(newLevel);
    // Khi user đổi level sau khi đã có kết quả → clear result để "Nén" lại
    if (result) {
      setResult(null);
      setError(null);
    }
  };

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const r = await compressPdf(file, level);
      setResult({
        blob: r.blob,
        originalSize: r.originalSize,
        compressedSize: r.compressedSize,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nén thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace('.pdf', '_compressed.pdf') : 'compressed.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setOriginalThumb(null);
    setCompressedThumb(null);
  };

  const reduction = result
    ? Math.round((1 - result.compressedSize / result.originalSize) * 100)
    : 0;

  const activePreset = PRESETS.find((p) => p.level === level) ?? PRESETS[1];

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        icon={Minimize2}
        title="Nén PDF"
        subtitle={file ? file.name : 'Chọn 1 PDF để nén'}
        onBack={onBack}
        primaryAction={
          result
            ? { icon: Download, label: 'Tải file nén', onClick: handleDownload }
            : file
              ? {
                  icon: Minimize2,
                  label: 'Nén',
                  onClick: handleCompress,
                  disabled: isProcessing,
                  loading: isProcessing,
                }
              : undefined
        }
      />

      {!file && <DropZone onFiles={handleFiles} maxFiles={1} />}

      {file && (
        <div className="space-y-4">
          {/* Preset cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {PRESETS.map((preset) => {
              const isActive = level === preset.level;
              const isRecommended = recommendedLevel === preset.level;
              const estMin = fileSizeMb * preset.minRatio;
              const estMax = fileSizeMb * preset.maxRatio;
              const reducePctMin = Math.round((1 - preset.maxRatio) * 100);
              const reducePctMax = Math.round((1 - preset.minRatio) * 100);
              const Icon = preset.icon;
              return (
                <button
                  key={preset.level}
                  type="button"
                  onClick={() => handleLevelChange(preset.level)}
                  className={cn(
                    'group relative flex flex-col gap-3 rounded-lg border-2 p-4 text-left transition-[color,background-color,border-color] duration-150 ease-in-out',
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  {isRecommended && (
                    <span className="absolute -top-2 right-3 rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                      Đề xuất
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {preset.title}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-full border-2',
                        isActive
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/40',
                      )}
                    >
                      {isActive && (
                        <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        -{reducePctMin}~{reducePctMax}%
                      </span>
                      <span className="text-[11px] text-muted-foreground">giảm</span>
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      ~ {estMin.toFixed(1)}-{estMax.toFixed(1)} MB
                    </p>
                  </div>

                  <div className="mt-1 space-y-1 border-t border-border/40 pt-2">
                    <p className="text-[11px] leading-snug text-foreground/80">
                      {preset.useCase}
                    </p>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {preset.qualityNote}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Shared estimate chart — animate khi user click preset */}
          <EstimateChart fileSizeMb={fileSizeMb} preset={activePreset} />

          {isProcessing && <LoadingState variant="inline" label="Đang nén..." />}
          {error && <ErrorState compact message={error} />}

          {/* Result panel: preview before/after + size bar chart */}
          {result && (
            <div className="space-y-4 rounded-lg border border-success/30 bg-success/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-success">
                    Nén xong — giảm {reduction}%
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Chưa hài lòng? Chọn preset khác rồi Nén lại.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Đổi file
                </button>
              </div>

              {/* Size bar chart */}
              <SizeBarChart
                originalSize={result.originalSize}
                compressedSize={result.compressedSize}
              />

              {/* Preview before/after */}
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewCard label="Trước" thumbnail={originalThumb} loading={thumbLoading} />
                <PreviewCard label="Sau" thumbnail={compressedThumb} loading={!compressedThumb} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── EstimateChart (shared, animate khi chọn preset) ─────────

function EstimateChart({
  fileSizeMb,
  preset,
}: {
  fileSizeMb: number;
  preset: PresetInfo;
}) {
  const avgRatio = (preset.minRatio + preset.maxRatio) / 2;
  const estimateMb = fileSizeMb * avgRatio;
  const savedMb = fileSizeMb - estimateMb;
  const reducePct = Math.round((1 - avgRatio) * 100);
  const pct = Math.max(avgRatio * 100, 4);

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5 elev-surface">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Gốc
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {fileSizeMb.toFixed(2)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">MB</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Ước tính sau nén
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary transition-colors">
            ~{estimateMb.toFixed(2)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">MB</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Tiết kiệm
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-success">
            -{reducePct}%
            <span className="ml-1 text-sm font-medium text-muted-foreground tabular-nums">
              ({savedMb.toFixed(2)} MB)
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">
            Gốc
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-muted/40">
            <div className="h-full w-full rounded bg-muted-foreground/40" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">
            Nén
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-muted/40">
            <div
              className="h-full rounded bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SizeBarChart ────────────────────────────────────────────

function SizeBarChart({
  originalSize,
  compressedSize,
}: {
  originalSize: number;
  compressedSize: number;
}) {
  const originalMb = originalSize / 1024 / 1024;
  const compressedMb = compressedSize / 1024 / 1024;
  const ratio = originalSize > 0 ? compressedSize / originalSize : 0;

  return (
    <div className="space-y-2">
      <BarRow label="Gốc" sizeMb={originalMb} widthPct={100} variant="original" />
      <BarRow label="Nén" sizeMb={compressedMb} widthPct={ratio * 100} variant="compressed" />
    </div>
  );
}

function BarRow({
  label,
  sizeMb,
  widthPct,
  variant,
}: {
  label: string;
  sizeMb: number;
  widthPct: number;
  variant: 'original' | 'compressed';
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="relative h-6 flex-1 overflow-hidden rounded bg-muted/40">
        <div
          className={cn(
            'h-full rounded transition-[width] duration-500 ease-out',
            variant === 'original' ? 'bg-muted-foreground/40' : 'bg-success',
          )}
          style={{ width: `${Math.max(widthPct, 2)}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
        {sizeMb.toFixed(2)} MB
      </span>
    </div>
  );
}

// ─── PreviewCard ─────────────────────────────────────────────

function PreviewCard({
  label,
  thumbnail,
  loading,
}: {
  label: string;
  thumbnail: HTMLCanvasElement | null;
  loading: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !thumbnail) return;
    const el = canvasRef.current;
    el.width = thumbnail.width;
    el.height = thumbnail.height;
    const ctx = el.getContext('2d');
    if (ctx) ctx.drawImage(thumbnail, 0, 0);
  }, [thumbnail]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded border border-border bg-background p-2">
        {loading || !thumbnail ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <canvas
            ref={canvasRef}
            className="max-h-full max-w-full rounded shadow-sm"
            style={{ display: 'block' }}
          />
        )}
      </div>
    </div>
  );
}
