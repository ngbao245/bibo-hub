// ============================================================
// PDF Studio — Delete pages workspace (Full editor)
// ============================================================
// Multi-file input, 2-stage save (Xóa → Lưu/Tải).
// Toolbar full: New Page, Delete, Duplicate, Rotate L/R, Move popover,
// Move Before/After, Import file, Extract Pages, Undo/Redo, Select
// All/None/Invert, Zoom.
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Trash2,
  Download,
  Save,
  CheckSquare,
  Square,
  Repeat2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  FilePlus,
  Copy,
  MoveHorizontal,
  ArrowLeftToLine,
  ArrowRightToLine,
  FileOutput,
  FileUp,
  Undo2,
  Redo2,
  Check,
} from 'lucide-react';
import { LoadingState, ErrorState } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { DropZone } from './DropZone';
import { mergePages, extractPages, type PageSpec } from '../lib/operations';
import { usePdfStudioStore } from '../store';
import { ToolbarButton, ToolbarSeparator } from './WorkspaceToolbar';
import { WorkspaceHeader } from './WorkspaceHeader';
import { createBlankPagePdf, renderBlankThumbnail } from '../lib/blank-page';
import { getRotationStyle } from '../lib/rotation-style';
import { cn } from '@/lib/cn';

interface RemovePagesWorkspaceProps {
  onBack: () => void;
}

interface PageEntry {
  id: string;
  sourceFileId: string;
  sourceFile: File;
  sourceFileName: string;
  pageNum: number;
  rotation: number;
  thumbnail: HTMLCanvasElement | null;
}

const THUMB_SIZES = [180, 240, 300, 360, 420] as const;
const DEFAULT_ZOOM_INDEX = 1;
const OFFSCREEN_THUMB_WIDTH = 640;
const MAX_HISTORY = 30;

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

/** Shallow snapshot pages for history — share thumbnail canvas refs. */
function snapshot(pages: PageEntry[]): PageEntry[] {
  return pages.map((p) => ({ ...p }));
}

export function RemovePagesWorkspace({ onBack }: RemovePagesWorkspaceProps) {
  const [pages, setPagesRaw] = useState<PageEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoomIndex, setZoomIndex] = useState<number>(DEFAULT_ZOOM_INDEX);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // History stack — snapshots of pages array only. selectedIds không track.
  const [history, setHistory] = useState<PageEntry[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Move popover state
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveValue, setMoveValue] = useState('');

  // Extract options
  const [separatePdfs, setSeparatePdfs] = useState(false);

  // Hidden file input ref for "Thêm file" toolbar button
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPages = pages.length;
  const thumbMinWidth = THUMB_SIZES[zoomIndex];
  const selectedCount = selectedIds.size;
  const canDelete = selectedCount > 0 && selectedCount < totalPages;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // ─── History helpers ──────────────────────────────────────

  /** Commit new pages state + push to history. */
  const commitPages = useCallback(
    (newPages: PageEntry[]) => {
      const snap = snapshot(newPages);
      setPagesRaw(newPages);
      setHistory((prev) => {
        // Truncate future if not at end
        const trimmed = prev.slice(0, historyIndex + 1);
        const next = [...trimmed, snap].slice(-MAX_HISTORY);
        return next;
      });
      setHistoryIndex((idx) => Math.min(idx + 1, MAX_HISTORY - 1));
    },
    [historyIndex],
  );

  /** Set pages without adding to history (used for initial load + undo/redo). */
  const setPagesNoHistory = useCallback((newPages: PageEntry[]) => {
    setPagesRaw(newPages);
  }, []);

  const undo = () => {
    if (!canUndo) return;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    setPagesNoHistory(snapshot(history[newIdx]));
    // Clean selectedIds if refers to removed page
    setSelectedIds((prev) => {
      const validIds = new Set(history[newIdx].map((p) => p.id));
      const next = new Set<string>();
      for (const id of prev) if (validIds.has(id)) next.add(id);
      return next;
    });
  };

  const redo = () => {
    if (!canRedo) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    setPagesNoHistory(snapshot(history[newIdx]));
    setSelectedIds((prev) => {
      const validIds = new Set(history[newIdx].map((p) => p.id));
      const next = new Set<string>();
      for (const id of prev) if (validIds.has(id)) next.add(id);
      return next;
    });
  };

  // Keyboard shortcuts Ctrl/Cmd+Z / Ctrl/Cmd+Y
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUndo, canRedo, historyIndex, history]);

  // ─── Load PDF ─────────────────────────────────────────────

  const loadFileAndAppend = useCallback(async (file: File): Promise<PageEntry[]> => {
    const fileId = crypto.randomUUID();
    const newPages: PageEntry[] = [];
    try {
      const pdfjs = await ensurePdfjs();
      const ab = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: ab }).promise;
      const numPages = doc.numPages;
      for (let n = 1; n <= numPages; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = OFFSCREEN_THUMB_WIDTH / base.width;
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        if (ctx) await page.render({ canvasContext: ctx, viewport: vp }).promise;
        newPages.push({
          id: `${fileId}-p${n}`,
          sourceFileId: fileId,
          sourceFile: file,
          sourceFileName: file.name,
          pageNum: n,
          rotation: 0,
          thumbnail: canvas,
        });
      }
      doc.destroy();
    } catch {
      // silent
    }
    return newPages;
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const pdfs = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
      if (pdfs.length === 0) return;
      setError(null);
      setLoading(true);
      const loaded: PageEntry[] = [];
      try {
        for (const f of pdfs) {
          const p = await loadFileAndAppend(f);
          loaded.push(...p);
        }
      } finally {
        setLoading(false);
      }
      const nextPages = [...pages, ...loaded];
      if (pages.length === 0) {
        // Import lần đầu = barrier → reset history seed. Undo không qua điểm này.
        setPagesNoHistory(nextPages);
        setHistory([snapshot(nextPages)]);
        setHistoryIndex(0);
      } else {
        // Mid-way add file → commit như mutation thường (undo/redo được).
        commitPages(nextPages);
      }
    },
    [pages, loadFileAndAppend, setPagesNoHistory, commitPages],
  );

  // ─── Actions ──────────────────────────────────────────────

  const addBlankPage = async () => {
    const blob = await createBlankPagePdf();
    const file = new File([blob], `blank-${Date.now()}.pdf`, {
      type: 'application/pdf',
    });
    const thumb = renderBlankThumbnail(OFFSCREEN_THUMB_WIDTH);
    const fileId = crypto.randomUUID();
    const nextPages = [
      ...pages,
      {
        id: `${fileId}-p1`,
        sourceFileId: fileId,
        sourceFile: file,
        sourceFileName: file.name,
        pageNum: 1,
        rotation: 0,
        thumbnail: thumb,
      },
    ];
    if (pages.length === 0) {
      setPagesNoHistory(nextPages);
      setHistory([snapshot(nextPages)]);
      setHistoryIndex(0);
    } else {
      commitPages(nextPages);
    }
  };

  const duplicateSelected = () => {
    if (selectedCount === 0) return;
    const result: PageEntry[] = [];
    for (const p of pages) {
      result.push(p);
      if (selectedIds.has(p.id)) {
        result.push({
          ...p,
          id: `${p.id}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        });
      }
    }
    commitPages(result);
  };

  const rotateSelectedOrAll = (delta: number) => {
    const applyToAll = selectedCount === 0;
    commitPages(
      pages.map((p) =>
        applyToAll || selectedIds.has(p.id)
          ? { ...p, rotation: p.rotation + delta }
          : p,
      ),
    );
  };

  const moveSelectedTo = (insertAfterIdx: number) => {
    if (selectedCount === 0) return;
    const selected: PageEntry[] = [];
    const rest: PageEntry[] = [];
    let insertAdjust = insertAfterIdx;
    for (let i = 0; i < pages.length; i++) {
      if (selectedIds.has(pages[i].id)) {
        selected.push(pages[i]);
        if (i < insertAfterIdx) insertAdjust--;
      } else {
        rest.push(pages[i]);
      }
    }
    const finalIdx = Math.max(0, Math.min(insertAdjust, rest.length));
    const result = [...rest.slice(0, finalIdx), ...selected, ...rest.slice(finalIdx)];
    commitPages(result);
  };

  const moveBefore = () => moveSelectedTo(0);
  const moveAfter = () => moveSelectedTo(pages.length);

  const applyMovePopover = () => {
    const n = parseInt(moveValue, 10);
    if (isNaN(n) || n < 0 || n > totalPages) return;
    moveSelectedTo(n);
    setMoveOpen(false);
    setMoveValue('');
  };

  const togglePage = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => setSelectedIds(new Set(pages.map((p) => p.id)));
  const selectNone = () => setSelectedIds(new Set());
  const invertSelection = () =>
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const p of pages) if (!prev.has(p.id)) next.add(p.id);
      return next;
    });

  const zoomIn = () => setZoomIndex((i) => Math.min(THUMB_SIZES.length - 1, i + 1));
  const zoomOut = () => setZoomIndex((i) => Math.max(0, i - 1));

  const handleDelete = () => {
    if (!canDelete) return;
    commitPages(pages.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setError(null);
  };

  // ─── Export ───────────────────────────────────────────────

  const exportBlob = async (subsetSpecs?: PageSpec[]): Promise<Blob> => {
    const specs: PageSpec[] =
      subsetSpecs ??
      pages.map((p) => ({
        file: p.sourceFile,
        pageNum: p.pageNum,
        rotation: p.rotation,
      }));
    return mergePages(specs);
  };

  const handleSave = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    setProcessingLabel('Đang lưu...');
    setError(null);
    try {
      const blob = await exportBlob();
      const outName = pages[0].sourceFileName.replace(/\.pdf$/i, '_edited.pdf');
      usePdfStudioStore.getState().openInEditor(blob, outName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setIsProcessing(false);
      setProcessingLabel('');
    }
  };

  const handleDownload = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    setProcessingLabel('Đang tạo file...');
    setError(null);
    try {
      const blob = await exportBlob();
      const baseName = pages[0].sourceFileName.replace(/\.pdf$/i, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_edited.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải thất bại');
    } finally {
      setIsProcessing(false);
      setProcessingLabel('');
    }
  };

  const handleExtract = async () => {
    if (selectedCount === 0) return;
    setIsProcessing(true);
    setProcessingLabel('Đang trích xuất...');
    setError(null);
    try {
      const specs: PageSpec[] = pages
        .filter((p) => selectedIds.has(p.id))
        .map((p) => ({
          file: p.sourceFile,
          pageNum: p.pageNum,
          rotation: p.rotation,
        }));
      const blob = await extractPages(specs, separatePdfs, 'extract');
      const baseName = pages[0].sourceFileName.replace(/\.pdf$/i, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = blob.type.includes('zip') ? '.zip' : '.pdf';
      a.download = `${baseName}-extracted${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trích xuất thất bại');
    } finally {
      setIsProcessing(false);
      setProcessingLabel('');
    }
  };

  // Draw thumbnail
  const renderThumb = (src: HTMLCanvasElement | null, dst: HTMLCanvasElement) => {
    if (!src) return;
    dst.width = src.width;
    dst.height = src.height;
    const ctx = dst.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(src, 0, 0);
  };

  // ─── Primary + Secondary actions ──────────────────────────

  const primaryAction = (() => {
    if (pages.length === 0) return undefined;
    if (selectedCount > 0) {
      return {
        icon: Trash2,
        label: `Xóa (${selectedCount})`,
        onClick: handleDelete,
        disabled: !canDelete || isProcessing,
        variant: 'destructive' as const,
      };
    }
    if (historyIndex > 0) {
      return {
        icon: Save,
        label: 'Lưu',
        onClick: handleSave,
        disabled: isProcessing,
        loading: isProcessing && processingLabel.includes('lưu'),
      };
    }
    return undefined;
  })();

  const secondaryAction =
    selectedCount === 0 && historyIndex > 0
      ? {
          icon: Download,
          label: 'Tải',
          onClick: handleDownload,
          disabled: isProcessing,
          loading: isProcessing && processingLabel.includes('tạo'),
        }
      : undefined;

  return (
    <div className="space-y-3">
      <WorkspaceHeader
        icon={Trash2}
        title="Xoá trang"
        subtitle={pages.length > 0 ? `${totalPages} trang` : 'Chọn PDF'}
        onBack={onBack}
        toolbarActions={
          pages.length > 0 ? (
            <>
              {/* Edit ops */}
              <ToolbarButton
                icon={FileUp}
                label="Thêm file"
                onClick={() => fileInputRef.current?.click()}
              />
              <ToolbarButton
                icon={FilePlus}
                label="Trang trắng"
                onClick={addBlankPage}
              />
              <ToolbarButton
                icon={Copy}
                label="Nhân đôi"
                onClick={duplicateSelected}
                disabled={selectedCount === 0}
              />
              <ToolbarSeparator />

              {/* Rotate */}
              <ToolbarButton
                icon={RotateCcw}
                label="Xoay trái"
                onClick={() => rotateSelectedOrAll(-90)}
              />
              <ToolbarButton
                icon={RotateCw}
                label="Xoay phải"
                onClick={() => rotateSelectedOrAll(90)}
              />
              <ToolbarSeparator />

              {/* Move */}
              <div className="relative">
                <ToolbarButton
                  icon={MoveHorizontal}
                  label="Chèn..."
                  onClick={() => setMoveOpen((v) => !v)}
                  disabled={selectedCount === 0}
                  active={moveOpen}
                />
                {moveOpen && (
                  <MovePopover
                    max={totalPages}
                    value={moveValue}
                    onChange={setMoveValue}
                    onApply={applyMovePopover}
                    onClose={() => setMoveOpen(false)}
                  />
                )}
              </div>
              <ToolbarButton
                icon={ArrowLeftToLine}
                label="Đưa lên đầu"
                onClick={moveBefore}
                disabled={selectedCount === 0}
              />
              <ToolbarButton
                icon={ArrowRightToLine}
                label="Đưa xuống cuối"
                onClick={moveAfter}
                disabled={selectedCount === 0}
              />
              <ToolbarSeparator />

              {/* Extract */}
              <ToolbarButton
                icon={FileOutput}
                label="Trích xuất"
                onClick={handleExtract}
                disabled={selectedCount === 0 || isProcessing}
              />
              <ToolbarButton
                icon={FileOutput}
                label="Tách file riêng"
                onClick={() => setSeparatePdfs((v) => !v)}
                active={separatePdfs}
              />
              <ToolbarSeparator />

              {/* History */}
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

              {/* Select */}
              <ToolbarButton
                icon={CheckSquare}
                label="Chọn tất"
                onClick={selectAll}
                disabled={totalPages === 0}
                active={selectedCount === totalPages && totalPages > 0}
              />
              <ToolbarButton
                icon={Square}
                label="Bỏ chọn"
                onClick={selectNone}
                disabled={selectedCount === 0}
              />
              <ToolbarButton
                icon={Repeat2}
                label="Đảo chọn"
                onClick={invertSelection}
                disabled={totalPages === 0}
              />
              <ToolbarSeparator />

              {/* Zoom */}
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
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
      />

      {/* Hidden file input for "Thêm file" toolbar */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) handleFiles(files);
          e.target.value = '';
        }}
      />

      {pages.length === 0 && <DropZone onFiles={handleFiles} maxFiles={20} />}

      {pages.length > 0 && (
        <div className="space-y-3">
          {loading && (
            <div
              className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 elev-surface"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${thumbMinWidth}px, 1fr))`,
              }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[220px] w-full rounded" />
              ))}
            </div>
          )}

          {!loading && totalPages > 0 && (
            <div
              className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 elev-surface"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${thumbMinWidth}px, 1fr))`,
              }}
            >
              {pages.map((p, i) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <PageThumb
                    key={p.id}
                    index={i + 1}
                    entry={p}
                    isSelected={isSelected}
                    onToggle={() => togglePage(p.id)}
                    renderThumb={renderThumb}
                  />
                );
              })}
            </div>
          )}

          {isProcessing && <LoadingState variant="inline" label={processingLabel} />}
          {error && <ErrorState compact message={error} />}
        </div>
      )}
    </div>
  );
}

// ─── Page thumbnail card ─────────────────────────────────────

function PageThumb({
  index,
  entry,
  isSelected,
  onToggle,
  renderThumb,
}: {
  index: number;
  entry: PageEntry;
  isSelected: boolean;
  onToggle: () => void;
  renderThumb: (src: HTMLCanvasElement | null, dst: HTMLCanvasElement) => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'group relative w-full overflow-hidden rounded border-2 transition-[color,background-color,border-color,box-shadow] duration-150 ease-in-out',
        isSelected
          ? 'border-destructive bg-destructive/10 ring-1 ring-destructive/30'
          : 'border-border hover:border-primary/50',
      )}
    >
      <canvas
        ref={(el) => {
          if (el) renderThumb(entry.thumbnail, el);
        }}
        className="rounded"
        style={getRotationStyle(entry.rotation, { width: '100%', display: 'block' })}
      />
      <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 text-[10px] font-medium text-foreground tabular-nums">
        {index}
      </span>
      {isSelected && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-destructive/20">
          <span className="text-4xl font-bold text-destructive">✕</span>
        </div>
      )}
    </button>
  );
}

// ─── Move popover (input số "Chèn sau trang N") ───────────

function MovePopover({
  max,
  value,
  onChange,
  onApply,
  onClose,
}: {
  max: number;
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay attach để không catch chính click mở popover
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const parsedValue = parseInt(value, 10);
  const isValid = !isNaN(parsedValue) && parsedValue >= 0 && parsedValue <= max;

  return (
    <div
      ref={popoverRef}
      className="absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-xl border border-border/60 bg-popover p-3 elev-floating"
    >
      <p className="mb-2 text-xs font-medium text-foreground">Chèn sau trang</p>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isValid) onApply();
            if (e.key === 'Escape') onClose();
          }}
          className="h-8 w-20 rounded border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={onApply}
          disabled={!isValid}
          className="flex h-8 items-center gap-1 rounded bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          <Check className="h-3.5 w-3.5" />
          Chèn
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        Nhập "0" để chuyển lên đầu tài liệu. Tối đa: {max}.
      </p>
    </div>
  );
}
