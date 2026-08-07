// ============================================================
// PDF Studio — Thêm số trang workspace
// ============================================================
// Preview trái, sidebar phải, fit 100vh. pdf-lib drawText → text
// SELECTABLE/SEARCHABLE giữ nguyên.
//
// Sidebar redesign: workflow-driven inspector (Position hero →
// Style toolbar → Format chips → Range → Advanced collapsible)
// + sticky Apply footer. Cảm hứng: Adobe Acrobat / Figma inspector.
// ============================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Hash,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bold,
  Italic,
  FileUp,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { DropZone } from './DropZone';
import {
  addPageNumbers,
  type PageNumberOptions,
  type PageNumberPosition,
  type PageNumberFontFamily,
} from '../lib/operations';
import { WorkspaceHeader } from './WorkspaceHeader';
import { cn } from '@/lib/cn';

interface AddPageNumbersWorkspaceProps {
  onBack: () => void;
}

// DS V2 motion tokens
const MOTION_FAST = 'transition-[color,background-color,border-color] duration-150 ease-in-out';
const MOTION_SMOOTH = 'transition-[border-color,box-shadow,transform] duration-200 ease-in-out';

const POSITIONS: Array<{ key: PageNumberPosition; label: string }> = [
  { key: 'top-left', label: 'Trên trái' },
  { key: 'top-center', label: 'Trên giữa' },
  { key: 'top-right', label: 'Trên phải' },
  { key: 'bottom-left', label: 'Dưới trái' },
  { key: 'bottom-center', label: 'Dưới giữa' },
  { key: 'bottom-right', label: 'Dưới phải' },
];

const FORMAT_CHIPS: Array<{ value: string; label: string }> = [
  { value: '{n}', label: '{n}' },
  { value: '{n} / {total}', label: '{n}/{total}' },
  { value: 'Page {n}', label: 'Page n' },
];

const FONT_FAMILIES: Array<{ value: PageNumberFontFamily; label: string; css: string }> = [
  { value: 'helvetica', label: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
  { value: 'times', label: 'Times', css: '"Times New Roman", Times, serif' },
  { value: 'courier', label: 'Courier', css: '"Courier New", Courier, monospace' },
];

const COLOR_PRESETS = [
  '#000000',
  '#404040',
  '#808080',
  '#c00000',
  '#0066cc',
  '#008040',
  '#804080',
  '#c07000',
];

// Render scale được tính động khi load PDF — dựa vào chiều rộng preview area
// thực tế + devicePixelRatio. Đảm bảo canvas sharp khi CSS scale lên.
// Cap để tránh canvas quá to (memory/render time).
const MAX_RENDER_SCALE = 4;
const MIN_RENDER_SCALE = 1.5;

function computeRenderScale(pageWidthPt: number, containerWidthPx: number): number {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  // Target: canvas.width >= containerWidth * dpr để crisp
  const target = (containerWidthPx * dpr) / pageWidthPt;
  return Math.max(MIN_RENDER_SCALE, Math.min(MAX_RENDER_SCALE, target));
}

const DEFAULT_OPTS = {
  position: 'bottom-center' as PageNumberPosition,
  format: '{n}',
  useCustom: false,
  customFormat: '',
  startNumber: 1,
  fontSize: 12,
  margin: 30,
  fontFamily: 'helvetica' as PageNumberFontFamily,
  bold: false,
  italic: false,
  color: '#000000',
  fromPage: '',
  toPage: '',
  skipCover: false,
};

async function ensurePdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

interface PageInfo {
  canvas: HTMLCanvasElement;
  widthPt: number;
  heightPt: number;
}

export function AddPageNumbersWorkspace({ onBack }: AddPageNumbersWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState(DEFAULT_OPTS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const previewMainRef = useRef<HTMLElement>(null);

  // Insert token vào customFormat tại vị trí cursor
  const insertToken = (token: string) => {
    const el = customInputRef.current;
    const current = opts.customFormat;
    if (!el) {
      setOpts((prev) => ({ ...prev, useCustom: true, customFormat: current + token }));
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    setOpts((prev) => ({ ...prev, useCustom: true, customFormat: next }));
    // Restore focus + move cursor sau token vừa chèn
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const activeFormat =
    opts.useCustom && opts.customFormat.trim() ? opts.customFormat : opts.format;

  function setOpt<K extends keyof typeof DEFAULT_OPTS>(
    key: K,
    value: (typeof DEFAULT_OPTS)[K],
  ) {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }

  const handleFiles = async (files: File[]) => {
    const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) return;
    setFile(pdf);
    setResult(null);
    setError(null);
    setCurrentPageIdx(0);
    setLoading(true);
    try {
      const pdfjs = await ensurePdfjs();
      const ab = await pdf.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: ab }).promise;
      const loaded: PageInfo[] = [];
      // Đo preview container để pick scale phù hợp (crisp nhưng không thừa)
      const containerW = previewMainRef.current?.clientWidth ?? 800;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const renderScale = computeRenderScale(base.width, containerW);
        const vp = page.getViewport({ scale: renderScale });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        if (ctx) await page.render({ canvasContext: ctx, viewport: vp }).promise;
        loaded.push({ canvas, widthPt: base.width, heightPt: base.height });
      }
      doc.destroy();
      setPages(loaded);
    } catch {
      setError('Không đọc được file PDF');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = pages.length;
  const currentPage = pages[currentPageIdx];
  const currentPageIs1Based = currentPageIdx + 1;

  const effectiveFrom = Math.max(1, opts.skipCover ? 2 : parseInt(opts.fromPage) || 1);
  const effectiveTo = Math.min(
    totalPages || Infinity,
    parseInt(opts.toPage) || totalPages,
  );
  const inRange =
    currentPageIs1Based >= effectiveFrom && currentPageIs1Based <= effectiveTo;
  const displayPageNum =
    opts.startNumber + Math.max(0, currentPageIs1Based - effectiveFrom);
  const displayTotal = Math.max(0, effectiveTo - effectiveFrom + 1);

  const previewText = useMemo(() => {
    if (!inRange) return '';
    return activeFormat
      .replace(/\{n\}/g, String(displayPageNum))
      .replace(/\{total\}/g, String(displayTotal))
      .replace(/\{start\}/g, String(opts.startNumber));
  }, [activeFormat, displayPageNum, displayTotal, opts.startNumber, inRange]);

  const fontCss = FONT_FAMILIES.find((f) => f.value === opts.fontFamily)?.css ?? '';

  // Overlay dùng đơn vị tương đối để scale theo container:
  //   - Margin: % của trang (width cho X, height cho Y)
  //   - Font-size: cqw (container query width) → scale khi container resize
  const overlayStyle = useMemo(() => {
    if (!currentPage) return {} as React.CSSProperties;
    const marginXPct = (opts.margin / currentPage.widthPt) * 100;
    const marginYPct = (opts.margin / currentPage.heightPt) * 100;
    const fontCqw = (opts.fontSize / currentPage.widthPt) * 100;

    const style: React.CSSProperties = {
      position: 'absolute',
      fontSize: `${fontCqw}cqw`,
      fontFamily: fontCss,
      fontWeight: opts.bold ? 700 : 400,
      fontStyle: opts.italic ? 'italic' : 'normal',
      color: opts.color,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      lineHeight: 1,
    };
    switch (opts.position) {
      case 'top-left':
        style.top = `${marginYPct}%`;
        style.left = `${marginXPct}%`;
        break;
      case 'top-center':
        style.top = `${marginYPct}%`;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;
      case 'top-right':
        style.top = `${marginYPct}%`;
        style.right = `${marginXPct}%`;
        break;
      case 'bottom-left':
        style.bottom = `${marginYPct}%`;
        style.left = `${marginXPct}%`;
        break;
      case 'bottom-center':
        style.bottom = `${marginYPct}%`;
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        break;
      case 'bottom-right':
        style.bottom = `${marginYPct}%`;
        style.right = `${marginXPct}%`;
        break;
    }
    return style;
  }, [opts.position, opts.bold, opts.italic, opts.color, opts.margin, opts.fontSize, fontCss, currentPage]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current || !currentPage) return;
    const el = canvasRef.current;
    el.width = currentPage.canvas.width;
    el.height = currentPage.canvas.height;
    const ctx = el.getContext('2d');
    if (ctx) ctx.drawImage(currentPage.canvas, 0, 0);
  }, [currentPage]);

  const handleApply = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const options: PageNumberOptions = {
        position: opts.position,
        format: activeFormat,
        startNumber: opts.startNumber,
        fontSize: opts.fontSize,
        margin: opts.margin,
        fontFamily: opts.fontFamily,
        bold: opts.bold,
        italic: opts.italic,
        color: opts.color,
        fromPage: opts.fromPage ? parseInt(opts.fromPage) : undefined,
        toPage: opts.toPage ? parseInt(opts.toPage) : undefined,
        skipCover: opts.skipCover,
      };
      const blob = await addPageNumbers(file, options);
      setResult(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm số trang thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !file) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.pdf$/i, '_numbered.pdf');
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chip nào đang active trong format row
  const activeChip =
    !opts.useCustom && FORMAT_CHIPS.find((c) => c.value === opts.format)
      ? opts.format
      : null;

  return (
    <div className="space-y-3">
      <WorkspaceHeader
        icon={Hash}
        title="Thêm số trang"
        subtitle={file ? file.name : 'Chọn PDF để đánh số trang'}
        onBack={onBack}
        secondaryAction={
          file
            ? {
                icon: FileUp,
                label: 'Đổi file',
                onClick: () => fileInputRef.current?.click(),
              }
            : undefined
        }
        primaryAction={
          result
            ? { icon: Download, label: 'Tải file', onClick: handleDownload }
            : file
              ? {
                  icon: Hash,
                  label: 'Áp dụng',
                  onClick: handleApply,
                  disabled: isProcessing || displayTotal === 0,
                  loading: isProcessing,
                }
              : undefined
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) handleFiles(files);
          e.target.value = '';
        }}
      />

      {!file && <DropZone onFiles={handleFiles} maxFiles={1} />}

      {file && (
        <div className="flex h-[calc(100vh-11rem)] gap-3 overflow-hidden">
          {/* Preview */}
          <main
            ref={previewMainRef}
            className={cn(
              'flex flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-muted/30 elev-surface p-4',
              MOTION_SMOOTH,
            )}
          >
            {/* PDF stage — flex-1 để fit tối đa, min-h-0 để aspect-ratio scale */}
            <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
              {loading && (
                <div
                  style={{
                    aspectRatio: '595/842',
                    maxHeight: '100%',
                    maxWidth: '100%',
                    height: '100%',
                    width: 'auto',
                  }}
                >
                  <Skeleton className="h-full w-full rounded border border-border/60" />
                </div>
              )}
              {!loading && currentPage && (
                <div
                  className="relative overflow-hidden rounded border border-border/60"
                  style={{
                    background: '#fff',
                    aspectRatio: `${currentPage.widthPt} / ${currentPage.heightPt}`,
                    maxHeight: '100%',
                    maxWidth: '100%',
                    height: '100%',
                    width: 'auto',
                    containerType: 'inline-size',
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    className="block h-full w-full"
                  />
                  {previewText && <span style={overlayStyle}>{previewText}</span>}
                </div>
              )}
            </div>

            {!loading && currentPage && totalPages > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setCurrentPageIdx((i) => Math.max(0, i - 1))}
                      disabled={currentPageIdx === 0}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-card text-foreground hover:border-border disabled:cursor-not-allowed disabled:opacity-40',
                        MOTION_FAST,
                      )}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-[80px] text-center tabular-nums text-muted-foreground">
                      Trang {currentPageIs1Based} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPageIdx((i) => Math.min(totalPages - 1, i + 1))
                      }
                      disabled={currentPageIdx === totalPages - 1}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-card text-foreground hover:border-border disabled:cursor-not-allowed disabled:opacity-40',
                        MOTION_FAST,
                      )}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
            {error && <ErrorState compact message={error} />}
            {result && (
              <div className="mt-3 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs">
                <p className="font-medium text-success">
                  Đã thêm số trang — text vẫn selectable / searchable
                </p>
              </div>
            )}
          </main>

          {/* Sidebar inspector */}
          <aside
            className={cn(
              'flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card elev-surface',
              MOTION_SMOOTH,
            )}
          >
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-5 px-4 py-4">
                {/* ── POSITION HERO ─────────────────────────── */}
                <section className="space-y-2">
                  <SectionLabel>Vị trí</SectionLabel>
                  <div className="grid grid-cols-3 gap-1.5">
                    {POSITIONS.map((p) => {
                      const active = opts.position === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setOpt('position', p.key)}
                          className={cn(
                            'group relative flex h-14 items-center justify-center rounded-lg border',
                            MOTION_FAST,
                            active
                              ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]'
                              : 'border-border/50 bg-muted/30 hover:border-border hover:bg-muted/60',
                          )}
                          aria-label={p.label}
                          title={p.label}
                        >
                          <PositionIcon pos={p.key} active={active} />
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* ── STYLE TOOLBAR ─────────────────────────── */}
                <section className="space-y-2">
                  <SectionLabel>Kiểu</SectionLabel>

                  <div className="flex items-center gap-1.5">
                    <Select
                      value={opts.fontFamily}
                      onValueChange={(v) => setOpt('fontFamily', v as PageNumberFontFamily)}
                    >
                      <SelectTrigger className="h-8 flex-1 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_FAMILIES.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            <span style={{ fontFamily: f.css }}>{f.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex overflow-hidden rounded-lg border border-border/60">
                      <ToggleIcon
                        active={opts.bold}
                        onClick={() => setOpt('bold', !opts.bold)}
                        label="Đậm"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </ToggleIcon>
                      <div className="w-px bg-border/60" />
                      <ToggleIcon
                        active={opts.italic}
                        onClick={() => setOpt('italic', !opts.italic)}
                        label="Nghiêng"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </ToggleIcon>
                    </div>
                  </div>

                  {/* Size row */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-[11px] font-medium text-muted-foreground">
                      Cỡ
                    </span>
                    <input
                      type="range"
                      min={8}
                      max={48}
                      value={opts.fontSize}
                      onChange={(e) => setOpt('fontSize', parseInt(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {opts.fontSize}
                    </span>
                  </div>

                  {/* Color row — presets + more */}
                  <div className="flex items-center gap-1.5">
                    {COLOR_PRESETS.slice(0, 7).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setOpt('color', c);
                        }}
                        className={cn(
                          'h-6 w-6 shrink-0 rounded-full border-2',
                          MOTION_SMOOTH,
                          opts.color === c
                            ? 'border-primary shadow-[0_0_0_2px_hsl(var(--background))]'
                            : 'border-border/60 hover:border-border',
                        )}
                        style={{ background: c }}
                        title={c}
                        aria-label={`Màu ${c}`}
                      />
                    ))}
                    <label
                      className={cn(
                        'relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-border/80 text-muted-foreground hover:border-border hover:text-foreground',
                        MOTION_FAST,
                      )}
                      title="Màu khác"
                    >
                      <Plus className="h-3 w-3" />
                      <input
                        type="color"
                        value={opts.color}
                        onChange={(e) => setOpt('color', e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </label>
                  </div>
                </section>

                {/* ── FORMAT CHIPS ──────────────────────────── */}
                <section className="space-y-2">
                  <SectionLabel>Định dạng</SectionLabel>
                  <div className="grid grid-cols-3 gap-1.5">
                    {FORMAT_CHIPS.map((chip) => (
                      <FormatChip
                        key={chip.value}
                        active={activeChip === chip.value}
                        onClick={() => {
                          setOpt('useCustom', false);
                          setOpt('format', chip.value);
                        }}
                      >
                        {chip.label}
                      </FormatChip>
                    ))}
                  </div>
                  {opts.useCustom ? (
                    <div className="flex items-center gap-1.5">
                      <FormatChip
                        active
                        onClick={() => setOpt('useCustom', true)}
                      >
                        Tuỳ chỉnh
                      </FormatChip>
                      <button
                        type="button"
                        onClick={() => insertToken('{n}')}
                        className={cn(
                          'h-7 shrink-0 rounded-md border border-border/60 bg-muted/40 px-2 font-mono text-[11px] text-foreground hover:border-border hover:bg-muted',
                          MOTION_FAST,
                        )}
                        title="Chèn số trang hiện tại"
                      >
                        {'{n}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertToken('{total}')}
                        className={cn(
                          'h-7 shrink-0 rounded-md border border-border/60 bg-muted/40 px-2 font-mono text-[11px] text-foreground hover:border-border hover:bg-muted',
                          MOTION_FAST,
                        )}
                        title="Chèn tổng số trang"
                      >
                        {'{total}'}
                      </button>
                    </div>
                  ) : (
                    <FormatChip
                      active={false}
                      onClick={() => setOpt('useCustom', true)}
                      className="w-full"
                    >
                      Tuỳ chỉnh
                    </FormatChip>
                  )}
                  {opts.useCustom && (
                    <Input
                      ref={customInputRef}
                      value={opts.customFormat}
                      onChange={(e) => setOpt('customFormat', e.target.value)}
                      placeholder="VD: [ {n}/{total} ]"
                      className="h-8 font-mono text-xs"
                      autoFocus
                    />
                  )}
                </section>

                {/* ── RANGE ─────────────────────────────────── */}
                <section className="space-y-2">
                  <SectionLabel>Phạm vi</SectionLabel>

                  <label className="flex cursor-pointer items-center gap-2 py-0.5">
                    <Checkbox
                      id="skip-cover"
                      checked={opts.skipCover}
                      onCheckedChange={(v) => setOpt('skipCover', v === true)}
                    />
                    <span className="text-xs text-foreground">
                      Bỏ trang bìa
                    </span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={opts.fromPage}
                      onChange={(e) => setOpt('fromPage', e.target.value)}
                      placeholder="1"
                      className="h-8 flex-1 text-center text-xs"
                      disabled={opts.skipCover}
                      aria-label="Từ trang"
                    />
                    <span className="text-xs text-muted-foreground/70">→</span>
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={opts.toPage}
                      onChange={(e) => setOpt('toPage', e.target.value)}
                      placeholder={String(totalPages)}
                      className="h-8 flex-1 text-center text-xs"
                      aria-label="Đến trang"
                    />
                  </div>
                </section>

                {/* ── ADVANCED (collapsible) ────────────────── */}
                <section>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 hover:text-foreground',
                      MOTION_FAST,
                    )}
                    aria-expanded={showAdvanced}
                    aria-controls="advanced-panel"
                  >
                    <span>Nâng cao</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200 ease-in-out',
                        showAdvanced && 'rotate-180',
                      )}
                    />
                  </button>

                  {showAdvanced && (
                    <div id="advanced-panel" className="mt-2 space-y-3">
                      {/* Margin */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Lề (pt)
                          </span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {opts.margin}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          value={opts.margin}
                          onChange={(e) => setOpt('margin', parseInt(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>

                      {/* Start number */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Bắt đầu từ
                        </span>
                        <Input
                          type="number"
                          min={1}
                          value={opts.startNumber}
                          onChange={(e) =>
                            setOpt(
                              'startNumber',
                              Math.max(1, parseInt(e.target.value) || 1),
                            )
                          }
                          className="h-8 w-20 text-center text-xs"
                        />
                      </div>
                    </div>
                  )}
                </section>

                {/* Reset — outline button, đủ nổi để nhận biết là action */}
                <button
                  type="button"
                  onClick={() => {
                    setOpts(DEFAULT_OPTS);
                    setShowAdvanced(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium text-foreground hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive',
                    MOTION_FAST,
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Đặt lại tất cả
                </button>
              </div>
            </div>

          </aside>
        </div>
      )}
    </div>
  );
}

// ─── Section label (inspector-style, minimal) ──────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
        {children}
      </h3>
      <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
    </div>
  );
}

// ─── Format chip ───────────────────────────────────────────

function FormatChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 rounded-md px-2.5 font-mono text-[11px]',
        MOTION_FAST,
        active
          ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.4)]'
          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ─── Style toolbar toggle (icon-only) ──────────────────────

function ToggleIcon({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex h-8 w-8 items-center justify-center',
        MOTION_FAST,
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-card text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

// ─── Position icon (page shape + dot) ──────────────────────

function PositionIcon({
  pos,
  active,
}: {
  pos: PageNumberPosition;
  active: boolean;
}) {
  const [vert, horiz] = pos.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  const cx = horiz === 'left' ? 6 : horiz === 'right' ? 20 : 13;
  const cy = vert === 'top' ? 5 : 25;
  return (
    <svg viewBox="0 0 26 30" width="24" height="28" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="23"
        height="27"
        rx="2"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity={active ? 0.7 : 0.35}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.04 : 0}
      />
      <circle cx={cx} cy={cy} r={active ? 2.4 : 1.8} fill="currentColor" />
    </svg>
  );
}
