// ============================================================
// PDF Studio — Split workspace (Split + Extract tabs, multi-file)
// ============================================================
// Tab Split: visual scissors / text range / stepper (3 mode giữ nguyên).
// Tab Extract: checkbox chọn trang, toggle Separate PDFs (combined vs ZIP).
// Multi-file input: nhiều PDF nối tiếp thành 1 stream pages.
// Toolbar: Rotate all, Add file, Add blank page.
// ============================================================

import { Fragment, useState, useMemo, useCallback, useEffect } from 'react';
import {
  Scissors,
  Download,
  Type,
  MousePointerClick,
  RefreshCw,
  RotateCw,
  FilePlus,
  FileOutput,
  CheckSquare,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LoadingState, ErrorState } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { DropZone } from './DropZone';
import { splitPages, extractPages, type PageSpec } from '../lib/operations';
import { ToolbarButton, ToolbarSeparator } from './WorkspaceToolbar';
import { WorkspaceHeader } from './WorkspaceHeader';
import { AddFileCard } from './shared/AddFileCard';
import { CardHoverActions } from './shared/CardHoverActions';
import { PageStepper } from './shared/PageStepper';
import { PagePreviewModal } from './shared/PagePreviewModal';
import { createBlankPagePdf, renderBlankThumbnail } from '../lib/blank-page';
import { getRotationStyle } from '../lib/rotation-style';
import { useHistoryState } from '../lib/use-history-state';
import { cn } from '@/lib/cn';

interface SplitWorkspaceProps {
  onBack: () => void;
}

interface PageEntry {
  id: string;
  sourceFileId: string;
  sourceFile: File;
  sourceFileName: string;
  pageNum: number; // 1-indexed in source
  rotation: number;
  thumbnail: HTMLCanvasElement | null;
  loading: boolean;
}

type TabMode = 'split' | 'extract';
type SplitMode = 'visual' | 'text';

const THUMB_WIDTH = 320;

// Group colors cho Split visual mode (khi có scissors, phân biệt output groups).
const GROUP_CLASSES = [
  'bg-emerald-500/15 hover:bg-emerald-500/25',
  'bg-purple-500/15 hover:bg-purple-500/25',
  'bg-amber-500/15 hover:bg-amber-500/25',
  'bg-sky-500/15 hover:bg-sky-500/25',
  'bg-rose-500/15 hover:bg-rose-500/25',
  'bg-lime-500/15 hover:bg-lime-500/25',
  'bg-orange-500/15 hover:bg-orange-500/25',
  'bg-indigo-500/15 hover:bg-indigo-500/25',
];

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

export function SplitWorkspace({ onBack }: SplitWorkspaceProps) {
  const {
    state: pages,
    commit: commitPages,
    reset: resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistoryState<PageEntry[]>([], {
    cloneFn: (v) => v.map((p) => ({ ...p })),
  });
  const [tab, setTab] = useState<TabMode>('split');
  const [splitMode, setSplitMode] = useState<SplitMode>('visual');
  const [splitPoints, setSplitPoints] = useState<Set<string>>(new Set());
  const [rangeText, setRangeText] = useState('');
  const [stepperEnabled, setStepperEnabled] = useState(false);
  const [stepperValue, setStepperValue] = useState(2);

  // Extract state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [separatePdfs, setSeparatePdfs] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalPages = pages.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Load 1 file → return page entries (không commit vào state trực tiếp)
  const loadFilePages = useCallback(async (file: File): Promise<PageEntry[]> => {
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
        const scale = THUMB_WIDTH / base.width;
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
          loading: false,
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
      const startingPages = pages;
      const wasEmpty = startingPages.length === 0;
      setResult(null);
      setError(null);
      setLoading(true);
      try {
        const collected: PageEntry[] = [];
        for (const file of pdfs) {
          const newPages = await loadFilePages(file);
          collected.push(...newPages);
        }
        const nextPages = [...startingPages, ...collected];
        if (wasEmpty) {
          // Import lần đầu = barrier → reset history. Undo không qua điểm này.
          resetHistory(nextPages);
        } else {
          // Mid-way add file → commit như mutation thường (undo được).
          commitPages(nextPages);
        }
      } finally {
        setLoading(false);
      }
    },
    [pages, loadFilePages, resetHistory, commitPages],
  );

  const addBlankPage = async () => {
    const blob = await createBlankPagePdf();
    const file = new File([blob], `blank-${Date.now()}.pdf`, {
      type: 'application/pdf',
    });
    const thumb = renderBlankThumbnail(THUMB_WIDTH);
    const fileId = crypto.randomUUID();
    const newPage: PageEntry = {
      id: `${fileId}-p1`,
      sourceFileId: fileId,
      sourceFile: file,
      sourceFileName: file.name,
      pageNum: 1,
      rotation: 0,
      thumbnail: thumb,
      loading: false,
    };
    const nextPages = [...pages, newPage];
    if (pages.length === 0) {
      resetHistory(nextPages);
    } else {
      commitPages(nextPages);
    }
    setResult(null);
  };

  const rotateAll = () => {
    commitPages((prev) => prev.map((p) => ({ ...p, rotation: p.rotation + 90 })));
    setResult(null);
  };

  const toggleSplit = (pageId: string) => {
    setSplitPoints((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
    setRangeText('');
    setStepperEnabled(false);
  };

  const resetSplits = () => {
    setSplitPoints(new Set());
    setRangeText('');
    setStepperEnabled(false);
  };

  // Stepper applies uniform step scissors
  useEffect(() => {
    if (!stepperEnabled || totalPages < 2) {
      if (stepperEnabled) setSplitPoints(new Set());
      return;
    }
    const points = new Set<string>();
    for (let i = stepperValue; i < totalPages; i += stepperValue) {
      points.add(pages[i - 1]?.id ?? '');
    }
    setSplitPoints(points);
  }, [stepperEnabled, stepperValue, totalPages, pages]);

  // Cleanup stale IDs sau undo/redo (pages có thể chứa hoặc mất IDs)
  useEffect(() => {
    const validIds = new Set(pages.map((p) => p.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (validIds.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
    setSplitPoints((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (validIds.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [pages]);

  // Split groups computed from splitPoints (or rangeText in text mode)
  const splitGroups = useMemo<number[][]>(() => {
    if (splitMode === 'text' && rangeText.trim()) {
      // Parse "1-3, 5, 7-end" → groups of pageIdx
      const total = totalPages;
      try {
        const parts = rangeText.split(',').map((s) => s.trim()).filter(Boolean);
        return parts.map((t) => {
          if (!t.includes('-')) {
            const p = parseInt(t, 10);
            if (isNaN(p) || p < 1 || p > total) throw new Error();
            return [p - 1];
          }
          const [a, b] = t.split('-');
          const aa = parseInt(a, 10);
          const bb = b.trim().toLowerCase() === 'end' ? total : parseInt(b, 10);
          if (isNaN(aa) || isNaN(bb) || aa < 1 || bb > total || aa > bb) throw new Error();
          return Array.from({ length: bb - aa + 1 }, (_, k) => aa - 1 + k);
        });
      } catch {
        return [];
      }
    }
    // Visual mode: split by scissors
    if (splitPoints.size === 0) return [];
    const groups: number[][] = [];
    let current: number[] = [];
    for (let i = 0; i < pages.length; i++) {
      current.push(i);
      if (splitPoints.has(pages[i].id)) {
        groups.push(current);
        current = [];
      }
    }
    if (current.length > 0) groups.push(current);
    return groups;
  }, [splitMode, rangeText, splitPoints, pages, totalPages]);

  const splitCount = splitGroups.length;

  const removePage = (id: string) => {
    if (pages.length <= 1) return;
    commitPages((prev) => prev.filter((p) => p.id !== id));
    setSplitPoints((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setResult(null);
  };

  const duplicatePage = (id: string) => {
    commitPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const clone: PageEntry = {
        ...prev[idx],
        id: `${prev[idx].id}-dup-${Date.now()}`,
      };
      return [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
    });
    setResult(null);
  };

  const rotatePage = (id: string) => {
    commitPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: p.rotation + 90 } : p)),
    );
    setResult(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pages.map((p) => p.id)));
    }
    setResult(null);
  };

  const [previewPageId, setPreviewPageId] = useState<string | null>(null);
  const previewPage = pages.find((p) => p.id === previewPageId) ?? null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    commitPages((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setResult(null);
  };

  const handleSplit = async () => {
    if (tab !== 'split' || splitGroups.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const specs: PageSpec[] = pages.map((p) => ({
        file: p.sourceFile,
        pageNum: p.pageNum,
        rotation: p.rotation,
      }));
      const baseName = pages[0]?.sourceFileName.replace(/\.pdf$/i, '') ?? 'split';
      const blob = await splitPages(specs, splitGroups, baseName);
      setResult(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tách thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtract = async () => {
    if (tab !== 'extract' || selectedIds.size === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const selectedSpecs: PageSpec[] = pages
        .filter((p) => selectedIds.has(p.id))
        .map((p) => ({ file: p.sourceFile, pageNum: p.pageNum, rotation: p.rotation }));
      const baseName = pages[0]?.sourceFileName.replace(/\.pdf$/i, '') ?? 'extract';
      const blob = await extractPages(selectedSpecs, separatePdfs, baseName);
      setResult(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extract thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    const isZip = result.type.includes('zip');
    const ext = isZip ? '.zip' : '.pdf';
    const baseName = pages[0]?.sourceFileName.replace(/\.pdf$/i, '') ?? 'output';
    const suffix = tab === 'split' ? '-split' : '-extract';
    a.download = `${baseName}${suffix}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group index for Split visual mode (color per group)
  const pageGroupIndex = useMemo(() => {
    const map = new Map<string, number>();
    let group = 0;
    for (const p of pages) {
      map.set(p.id, group);
      if (splitPoints.has(p.id)) group++;
    }
    return map;
  }, [pages, splitPoints]);

  const primaryAction = (() => {
    if (result) {
      return { icon: Download, label: 'Tải xuống', onClick: handleDownload };
    }
    if (pages.length === 0) return undefined;
    if (tab === 'split') {
      return {
        icon: Scissors,
        label: splitCount > 0 ? `Tách (${splitCount} file)` : 'Tách',
        onClick: handleSplit,
        disabled: splitCount === 0 || isProcessing,
        loading: isProcessing,
      };
    }
    return {
      icon: FileOutput,
      label: selectedIds.size > 0 ? `Extract (${selectedIds.size} trang)` : 'Extract',
      onClick: handleExtract,
      disabled: selectedIds.size === 0 || isProcessing,
      loading: isProcessing,
    };
  })();

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        icon={Scissors}
        title={tab === 'split' ? 'Tách PDF' : 'Extract PDF'}
        subtitle={
          pages.length > 0 ? `${totalPages} trang` : 'Kéo thả PDF để bắt đầu'
        }
        onBack={onBack}
        toolbarActions={
          pages.length > 0 ? (
            <>
              <ToolbarButton
                icon={Scissors}
                label="Split"
                active={tab === 'split'}
                onClick={() => setTab('split')}
              />
              <ToolbarButton
                icon={FileOutput}
                label="Extract"
                active={tab === 'extract'}
                onClick={() => setTab('extract')}
              />
              <ToolbarSeparator />
              {tab === 'split' ? (
                <>
                  <ToolbarButton
                    icon={MousePointerClick}
                    label="Trực quan"
                    active={splitMode === 'visual'}
                    onClick={() => setSplitMode('visual')}
                  />
                  <ToolbarButton
                    icon={Type}
                    label="Nhập range"
                    active={splitMode === 'text'}
                    onClick={() => setSplitMode('text')}
                  />
                  <ToolbarButton
                    icon={RefreshCw}
                    label="Reset"
                    onClick={resetSplits}
                    disabled={splitPoints.size === 0 && !rangeText}
                  />
                  <ToolbarSeparator />
                </>
              ) : (
                <>
                  <ToolbarButton
                    icon={CheckSquare}
                    label={selectedIds.size === pages.length ? 'Bỏ chọn tất' : 'Chọn tất'}
                    onClick={toggleSelectAll}
                    active={selectedIds.size === pages.length && pages.length > 0}
                  />
                  <ToolbarButton
                    icon={FileOutput}
                    label="Tách file riêng"
                    onClick={() => setSeparatePdfs((v) => !v)}
                    active={separatePdfs}
                  />
                  <ToolbarSeparator />
                </>
              )}
              <ToolbarButton icon={RotateCw} label="Xoay tất" onClick={rotateAll} />
              <ToolbarButton icon={FilePlus} label="Trang trắng" onClick={addBlankPage} />
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
            </>
          ) : undefined
        }
        primaryAction={primaryAction}
      />

      {pages.length === 0 && <DropZone onFiles={handleFiles} maxFiles={20} />}

      {pages.length > 0 && (
        <div className="space-y-3">
          {tab === 'split' && splitMode === 'visual' && (
            <PageStepper
              enabled={stepperEnabled}
              onToggle={setStepperEnabled}
              value={stepperValue}
              onChange={setStepperValue}
              max={totalPages - 1}
            />
          )}

          {tab === 'split' && splitMode === 'text' && (
            <input
              type="text"
              value={rangeText}
              onChange={(e) => {
                setRangeText(e.target.value);
                setSplitPoints(new Set());
                setStepperEnabled(false);
              }}
              placeholder="VD: 1-3, 4-7, 8-end"
              className="h-9 w-full rounded border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          )}

          {loading && (
            <div className="flex flex-wrap gap-y-4 rounded-xl border border-border/60 bg-card p-4 elev-surface">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center">
                  {i > 0 && <div className="w-10" />}
                  <Skeleton className="h-[302px] w-[228px] rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {!loading && totalPages > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-4 elev-surface">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pages.map((p) => p.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex flex-wrap items-center gap-y-4">
                    {pages.map((page, i) => {
                      const isLastCard = i === pages.length - 1;
                      const isSplitAfter = !isLastCard && splitPoints.has(page.id);
                      const isSelected = selectedIds.has(page.id);
                      const bgClass =
                        tab === 'extract'
                          ? isSelected
                            ? 'bg-primary/15 hover:bg-primary/25'
                            : 'hover:bg-muted/40'
                          : GROUP_CLASSES[
                              (pageGroupIndex.get(page.id) ?? 0) % GROUP_CLASSES.length
                            ];
                      return (
                        <Fragment key={page.id}>
                          <SortablePageCard
                            page={page}
                            bgClass={bgClass}
                            selected={isSelected}
                            showCheckbox={tab === 'extract'}
                            onToggleSelect={() => toggleSelect(page.id)}
                            onDelete={() => removePage(page.id)}
                            onDuplicate={() => duplicatePage(page.id)}
                            onRotate={() => rotatePage(page.id)}
                            onPreview={() => setPreviewPageId(page.id)}
                          />
                          {/* Scissors chỉ hiện Split tab visual mode */}
                          {tab === 'split' && splitMode === 'visual' && !isLastCard && (
                            <button
                              type="button"
                              onClick={() => toggleSplit(page.id)}
                              className="group/sep relative flex h-[302px] w-10 shrink-0 cursor-pointer items-center justify-center"
                              aria-label={`Cắt sau trang ${page.pageNum}`}
                              title={isSplitAfter ? 'Bỏ cắt' : `Cắt sau trang ${page.pageNum}`}
                            >
                              <svg
                                width="2"
                                height="226"
                                viewBox="0 0 2 226"
                                fill="none"
                                className={cn(
                                  'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors',
                                  isSplitAfter
                                    ? 'text-primary'
                                    : 'text-muted-foreground/40 group-hover/sep:text-foreground',
                                )}
                              >
                                <line
                                  x1="1"
                                  y1="0"
                                  x2="1"
                                  y2="226"
                                  stroke="currentColor"
                                  strokeWidth={isSplitAfter ? '2.5' : '2'}
                                  strokeLinecap="round"
                                  strokeDasharray={isSplitAfter ? '0' : '12 20'}
                                />
                              </svg>
                              <Scissors
                                className={cn(
                                  'relative h-5 w-5 transition-colors',
                                  isSplitAfter
                                    ? 'text-primary'
                                    : 'text-muted-foreground/40 group-hover/sep:text-foreground',
                                )}
                              />
                            </button>
                          )}
                        </Fragment>
                      );
                    })}
                    <div className="ml-6 mr-1 my-1">
                      <AddFileCard onFiles={handleFiles} multiple />
                    </div>
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {isProcessing && <LoadingState variant="inline" label="Đang xử lý..." />}
          {error && <ErrorState compact message={error} />}

          {result && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">
                {tab === 'split' ? 'Tách xong' : 'Extract xong'} —{' '}
                {result.type.includes('zip') ? 'ZIP' : 'PDF'} sẵn sàng
              </p>
            </div>
          )}
        </div>
      )}

      {previewPage && (
        <PagePreviewModal
          file={previewPage.sourceFile}
          pageNum={previewPage.pageNum}
          title={`${previewPage.sourceFileName} — trang ${previewPage.pageNum}`}
          subtitle={(() => {
            const displayAngle = ((previewPage.rotation % 360) + 360) % 360;
            const parts = [`Trang ${previewPage.pageNum}`];
            if (displayAngle !== 0) parts.push(`Xoay ${displayAngle}°`);
            return parts.join(' · ');
          })()}
          rotation={previewPage.rotation}
          onClose={() => setPreviewPageId(null)}
        />
      )}
    </div>
  );
}

// ─── Sortable Page Card ──────────────────────────────────────

function SortablePageCard({
  page,
  bgClass,
  selected,
  showCheckbox,
  onToggleSelect,
  onDelete,
  onDuplicate,
  onRotate,
  onPreview,
}: {
  page: PageEntry;
  bgClass: string;
  selected: boolean;
  showCheckbox: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRotate: () => void;
  onPreview: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/item relative m-1 box-border flex h-[302px] w-[228px] cursor-move flex-col items-center gap-3 rounded-lg px-1 py-3 transition-colors',
        bgClass,
      )}
      onClick={showCheckbox ? onToggleSelect : undefined}
      {...attributes}
      {...listeners}
    >
      {/* Checkbox góc trái-trên (Extract mode) */}
      {showCheckbox && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute left-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded border-2 border-border bg-background shadow-sm transition-colors hover:border-primary aria-checked:border-primary aria-checked:bg-primary aria-checked:text-primary-foreground"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Chọn trang ${page.pageNum}`}
        >
          {selected && (
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M5 12l5 5L20 7"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      )}

      <CardHoverActions
        onPreview={onPreview}
        onDuplicate={onDuplicate}
        onRotate={onRotate}
        onDelete={onDelete}
      />

      {/* Thumbnail */}
      <div className="flex h-[220px] w-[156px] items-center justify-center">
        {page.thumbnail ? (
          <canvas
            ref={(el) => {
              if (el && page.thumbnail) {
                el.width = page.thumbnail.width;
                el.height = page.thumbnail.height;
                const ctx = el.getContext('2d');
                if (ctx) ctx.drawImage(page.thumbnail, 0, 0);
              }
            }}
            className="max-h-full max-w-full rounded border border-border/60 bg-background"
            style={getRotationStyle(page.rotation, { display: 'block' })}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded border border-border/60 bg-muted/30">
            <span className="text-xs text-muted-foreground">...</span>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="flex w-full flex-col items-center gap-0.5 px-2">
        <p className="max-w-full truncate px-2 text-center text-xs font-medium text-foreground">
          {page.sourceFileName.replace(/\.pdf$/i, '')}_page_{page.pageNum}
        </p>
        {(() => {
          const displayAngle = ((page.rotation % 360) + 360) % 360;
          return (
            <p className="text-[11px] font-medium text-foreground/70">
              {page.pageNum}
              {displayAngle !== 0 && (
                <span className="ml-1 text-primary">{displayAngle}°</span>
              )}
            </p>
          );
        })()}
      </div>
    </div>
  );
}
