// ============================================================
// PDF Studio — Merge workspace (Files + Pages view, Undo/Redo)
// ============================================================
// Files view: 1 card = 1 file, thumbnail = page 1.
// Pages view: 1 card = 1 trang, drag reorder cross-file.
// Toolbar: view toggle, sort A-Z, rotate all, add blank, undo/redo,
// xoá hết. Ctrl+Z / Ctrl+Y keyboard shortcuts.
//
// History: track combined {entries, pageEntries} structural state.
// Thumbnails đặt trong `thumbnailsRef` NGOÀI history → undo/redo
// không xoá thumbnail cache. Silent updates (loading→false, pageCount
// sau async load, view mode switch) không push history.
// ============================================================

import { useCallback, useRef, useState, Fragment } from 'react';
import {
  Combine,
  Download,
  ArrowDownAZ,
  Trash2,
  RotateCw,
  FilePlus,
  Files,
  LayoutGrid,
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
import { mergePdfs, mergePages, type PageSpec } from '../lib/operations';
import { usePdfStudioStore } from '../store';
import { ToolbarButton, ToolbarSeparator } from './WorkspaceToolbar';
import { WorkspaceHeader } from './WorkspaceHeader';
import { AddFileCard } from './shared/AddFileCard';
import { CardHoverActions } from './shared/CardHoverActions';
import { PagePreviewModal } from './shared/PagePreviewModal';
import { InlineAddButton } from './shared/InlineAddButton';
import { createBlankPagePdf, renderBlankThumbnail } from '../lib/blank-page';
import { getRotationStyle } from '../lib/rotation-style';
import { useHistoryState } from '../lib/use-history-state';

interface MergeWorkspaceProps {
  onBack: () => void;
}

interface FileEntry {
  id: string;
  file: File;
  pageCount: number;
  loading: boolean;
  rotation: number;
}

interface PageEntry {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  pageNum: number;
  rotation: number;
  loading: boolean;
}

interface MergeState {
  entries: FileEntry[];
  pageEntries: PageEntry[];
}

type ViewMode = 'files' | 'pages';

const THUMB_WIDTH = 320;

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

async function renderPageThumb(
  file: File,
  pageNum: number,
): Promise<{ canvas: HTMLCanvasElement; numPages: number } | null> {
  try {
    const pdfjs = await ensurePdfjs();
    const ab = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: ab }).promise;
    const page = await doc.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const scale = THUMB_WIDTH / base.width;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    if (ctx) await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const numPages = doc.numPages;
    doc.destroy();
    return { canvas, numPages };
  } catch {
    return null;
  }
}

export function MergeWorkspace({ onBack }: MergeWorkspaceProps) {
  const {
    state: { entries, pageEntries },
    commit,
    setStateSilent,
    reset: resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistoryState<MergeState>(
    { entries: [], pageEntries: [] },
    {
      cloneFn: (v) => ({
        entries: v.entries.map((e) => ({ ...e })),
        pageEntries: v.pageEntries.map((p) => ({ ...p })),
      }),
    },
  );

  const thumbnailsRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Refs để đọc latest state trong async callbacks (closure có thể stale)
  const stateEntriesRef = useRef(entries);
  const statePageEntriesRef = useRef(pageEntries);
  stateEntriesRef.current = entries;
  statePageEntriesRef.current = pageEntries;

  const [viewMode, setViewMode] = useState<ViewMode>('files');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commitEntries = useCallback(
    (updater: FileEntry[] | ((prev: FileEntry[]) => FileEntry[])) => {
      commit((prev) => ({
        ...prev,
        entries:
          typeof updater === 'function'
            ? (updater as (p: FileEntry[]) => FileEntry[])(prev.entries)
            : updater,
      }));
    },
    [commit],
  );

  const commitPageEntries = useCallback(
    (updater: PageEntry[] | ((prev: PageEntry[]) => PageEntry[])) => {
      commit((prev) => ({
        ...prev,
        pageEntries:
          typeof updater === 'function'
            ? (updater as (p: PageEntry[]) => PageEntry[])(prev.pageEntries)
            : updater,
      }));
    },
    [commit],
  );

  const silentEntries = useCallback(
    (updater: (prev: FileEntry[]) => FileEntry[]) => {
      setStateSilent((prev) => ({ ...prev, entries: updater(prev.entries) }));
    },
    [setStateSilent],
  );

  const silentPageEntries = useCallback(
    (updater: (prev: PageEntry[]) => PageEntry[]) => {
      setStateSilent((prev) => ({
        ...prev,
        pageEntries: updater(prev.pageEntries),
      }));
    },
    [setStateSilent],
  );

  const totalPages =
    viewMode === 'files'
      ? entries.reduce((sum, e) => sum + e.pageCount, 0)
      : pageEntries.length;

  const canMerge =
    viewMode === 'files'
      ? entries.length >= 2 && entries.every((e) => !e.loading)
      : pageEntries.length >= 2 && pageEntries.every((p) => !p.loading);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const loadFileEntry = useCallback(
    async (entryId: string, file: File) => {
      const rendered = await renderPageThumb(file, 1);
      if (!rendered) {
        silentEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, loading: false } : e)),
        );
        return;
      }
      thumbnailsRef.current.set(entryId, rendered.canvas);
      silentEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, pageCount: rendered.numPages, loading: false }
            : e,
        ),
      );
    },
    [silentEntries],
  );

  const handleFilesAt = useCallback(
    (newFiles: File[], insertIdx?: number) => {
      const pdfs = newFiles.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
      if (pdfs.length === 0) return;
      const newEntries: FileEntry[] = pdfs.map((file) => ({
        id: crypto.randomUUID(),
        file,
        pageCount: 0,
        loading: true,
        rotation: 0,
      }));
      const prevEntries = entries;
      const nextEntries =
        insertIdx === undefined || insertIdx >= prevEntries.length
          ? [...prevEntries, ...newEntries]
          : [
              ...prevEntries.slice(0, insertIdx),
              ...newEntries,
              ...prevEntries.slice(insertIdx),
            ];
      if (prevEntries.length === 0) {
        // Import lần đầu = barrier → reset history seed. Undo không qua điểm này.
        resetHistory({ entries: nextEntries, pageEntries });
      } else {
        // Mid-way add file → commit như mutation thường (undo/redo được).
        commitEntries(nextEntries);
      }
      setResult(null);
      setError(null);
      newEntries.forEach((e) => loadFileEntry(e.id, e.file));
    },
    [entries, pageEntries, resetHistory, commitEntries, loadFileEntry],
  );

  const handleFiles = (newFiles: File[]) => handleFilesAt(newFiles);

  const handleFilesAtPagePos = useCallback(
    async (newFiles: File[], pageIdx: number) => {
      const pdfs = newFiles.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
      if (pdfs.length === 0) return;
      setResult(null);
      setError(null);

      let insertAt = pageIdx;
      const wasEmpty = stateEntriesRef.current.length === 0;
      // Silent add entry (loading), reset/commit history 1 lần cuối cùng cho toàn batch
      for (const file of pdfs) {
        const entryId = crypto.randomUUID();
        silentEntries((prev) => [
          ...prev,
          {
            id: entryId,
            file,
            pageCount: 0,
            loading: true,
            rotation: 0,
          },
        ]);

        try {
          const pdfjs = await ensurePdfjs();
          const ab = await file.arrayBuffer();
          const doc = await pdfjs.getDocument({ data: ab }).promise;
          const numPages = doc.numPages;
          const newPages: PageEntry[] = [];
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

            const pageId = `${entryId}-p${n}`;
            thumbnailsRef.current.set(pageId, canvas);
            if (n === 1) thumbnailsRef.current.set(entryId, canvas);

            newPages.push({
              id: pageId,
              sourceFileId: entryId,
              sourceFileName: file.name,
              pageNum: n,
              rotation: 0,
              loading: false,
            });
          }
          doc.destroy();

          const capturedInsertAt = insertAt;
          insertAt += newPages.length;

          silentEntries((prev) =>
            prev.map((e) =>
              e.id === entryId ? { ...e, pageCount: numPages, loading: false } : e,
            ),
          );
          silentPageEntries((prev) => [
            ...prev.slice(0, capturedInsertAt),
            ...newPages,
            ...prev.slice(capturedInsertAt),
          ]);
        } catch {
          silentEntries((prev) =>
            prev.map((e) => (e.id === entryId ? { ...e, loading: false } : e)),
          );
        }
      }
      // Import lần đầu = reset barrier. Mid-way = commit (undo được).
      const finalState = {
        entries: stateEntriesRef.current,
        pageEntries: statePageEntriesRef.current,
      };
      if (wasEmpty) {
        resetHistory(finalState);
      } else {
        commit(finalState);
      }
    },
    [resetHistory, commit, silentEntries, silentPageEntries],
  );

  const rotateAll = () => {
    if (viewMode === 'files') {
      commitEntries((prev) => prev.map((e) => ({ ...e, rotation: e.rotation + 90 })));
    } else {
      commitPageEntries((prev) =>
        prev.map((p) => ({ ...p, rotation: p.rotation + 90 })),
      );
    }
    setResult(null);
  };

  const addBlankPage = async () => {
    const blob = await createBlankPagePdf();
    const file = new File([blob], `blank-${Date.now()}.pdf`, {
      type: 'application/pdf',
    });
    const thumb = renderBlankThumbnail(THUMB_WIDTH);
    const fileId = crypto.randomUUID();
    thumbnailsRef.current.set(fileId, thumb);
    if (viewMode === 'pages') {
      thumbnailsRef.current.set(`${fileId}-p1`, thumb);
    }

    const newEntry: FileEntry = {
      id: fileId,
      file,
      pageCount: 1,
      loading: false,
      rotation: 0,
    };
    const nextEntries = [...entries, newEntry];
    let nextPageEntries = pageEntries;
    if (viewMode === 'pages') {
      const newPageEntry: PageEntry = {
        id: `${fileId}-p1`,
        sourceFileId: fileId,
        sourceFileName: file.name,
        pageNum: 1,
        rotation: 0,
        loading: false,
      };
      nextPageEntries = [...pageEntries, newPageEntry];
    }
    if (entries.length === 0) {
      resetHistory({ entries: nextEntries, pageEntries: nextPageEntries });
    } else {
      commit({ entries: nextEntries, pageEntries: nextPageEntries });
    }
    setResult(null);
  };

  const removeEntry = (id: string) => {
    commitEntries((prev) => prev.filter((e) => e.id !== id));
    setResult(null);
  };
  const duplicateEntry = (id: string) => {
    commitEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const cloneId = crypto.randomUUID();
      const clone: FileEntry = { ...prev[idx], id: cloneId };
      const srcThumb = thumbnailsRef.current.get(id);
      if (srcThumb) thumbnailsRef.current.set(cloneId, srcThumb);
      return [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
    });
    setResult(null);
  };
  const rotateEntry = (id: string) => {
    commitEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, rotation: e.rotation + 90 } : e)),
    );
    setResult(null);
  };

  const removePageEntry = (id: string) => {
    commitPageEntries((prev) => prev.filter((p) => p.id !== id));
    setResult(null);
  };
  const rotatePageEntry = (id: string) => {
    commitPageEntries((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: p.rotation + 90 } : p)),
    );
    setResult(null);
  };
  const duplicatePageEntry = (id: string) => {
    commitPageEntries((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const cloneId = `${prev[idx].id}-dup-${Date.now()}`;
      const clone: PageEntry = { ...prev[idx], id: cloneId };
      const srcThumb = thumbnailsRef.current.get(id);
      if (srcThumb) thumbnailsRef.current.set(cloneId, srcThumb);
      return [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
    });
    setResult(null);
  };

  const [previewEntryId, setPreviewEntryId] = useState<string | null>(null);
  const previewEntry = entries.find((e) => e.id === previewEntryId) ?? null;

  const [previewPageId, setPreviewPageId] = useState<string | null>(null);
  const previewPage = pageEntries.find((p) => p.id === previewPageId) ?? null;
  const previewPageFile = previewPage
    ? (entries.find((e) => e.id === previewPage.sourceFileId)?.file ?? null)
    : null;

  const removeAll = () => {
    commit({ entries: [], pageEntries: [] });
    setResult(null);
  };

  const sortByName = () => {
    commitEntries((prev) =>
      [...prev].sort((a, b) => a.file.name.localeCompare(b.file.name)),
    );
    setResult(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (viewMode === 'files') {
      commitEntries((prev) => {
        const oldIndex = prev.findIndex((e) => e.id === active.id);
        const newIndex = prev.findIndex((e) => e.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    } else {
      commitPageEntries((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id);
        const newIndex = prev.findIndex((p) => p.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
    setResult(null);
  };

  const switchView = useCallback(
    (mode: ViewMode) => {
      if (mode === viewMode) return;
      if (mode === 'pages') {
        const pages: PageEntry[] = [];
        const filesToLoadRest: FileEntry[] = [];
        for (const entry of entries) {
          if (entry.loading) continue;
          for (let n = 1; n <= entry.pageCount; n++) {
            const pageId = `${entry.id}-p${n}`;
            if (n === 1 && !thumbnailsRef.current.has(pageId)) {
              const entryThumb = thumbnailsRef.current.get(entry.id);
              if (entryThumb) thumbnailsRef.current.set(pageId, entryThumb);
            }
            pages.push({
              id: pageId,
              sourceFileId: entry.id,
              sourceFileName: entry.file.name,
              pageNum: n,
              rotation: entry.rotation,
              loading: n !== 1 && !thumbnailsRef.current.has(pageId),
            });
          }
          if (entry.pageCount > 1) filesToLoadRest.push(entry);
        }
        silentPageEntries(() => pages);
        setViewMode('pages');
        for (const entry of filesToLoadRest) {
          (async () => {
            try {
              const pdfjs = await ensurePdfjs();
              const ab = await entry.file.arrayBuffer();
              const doc = await pdfjs.getDocument({ data: ab }).promise;
              for (let n = 2; n <= doc.numPages; n++) {
                const pageId = `${entry.id}-p${n}`;
                if (thumbnailsRef.current.has(pageId)) continue;
                const page = await doc.getPage(n);
                const base = page.getViewport({ scale: 1 });
                const scale = THUMB_WIDTH / base.width;
                const vp = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = vp.width;
                canvas.height = vp.height;
                const ctx = canvas.getContext('2d');
                if (ctx) await page.render({ canvasContext: ctx, viewport: vp }).promise;
                thumbnailsRef.current.set(pageId, canvas);
                silentPageEntries((prev) =>
                  prev.map((p) => (p.id === pageId ? { ...p, loading: false } : p)),
                );
              }
              doc.destroy();
            } catch {
              // silent
            }
          })();
        }
      } else {
        const seen = new Set<string>();
        const reordered: FileEntry[] = [];
        for (const p of pageEntries) {
          if (seen.has(p.sourceFileId)) continue;
          seen.add(p.sourceFileId);
          const orig = entries.find((e) => e.id === p.sourceFileId);
          if (orig) reordered.push(orig);
        }
        silentEntries(() => reordered);
        setViewMode('files');
      }
    },
    [viewMode, entries, pageEntries, silentEntries, silentPageEntries],
  );

  const handleMerge = async () => {
    if (!canMerge) return;
    setIsProcessing(true);
    setError(null);
    try {
      let blob: Blob;
      if (viewMode === 'files') {
        blob = await mergePdfs(entries.map((e) => e.file));
      } else {
        const specs: PageSpec[] = [];
        for (const p of pageEntries) {
          const file = entries.find((e) => e.id === p.sourceFileId)?.file;
          if (!file) continue;
          specs.push({ file, pageNum: p.pageNum, rotation: p.rotation });
        }
        if (specs.length < 2) throw new Error('Cần ít nhất 2 trang để gộp');
        blob = await mergePages(specs);
      }
      setResult(blob);
      usePdfStudioStore.getState().openInEditor(blob, 'merged.pdf');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gộp thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merged.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <WorkspaceHeader
        icon={Combine}
        title="Gộp PDF"
        subtitle={
          entries.length > 0
            ? viewMode === 'files'
              ? `${entries.length} file · ${totalPages} trang`
              : `${totalPages} trang`
            : 'Kéo thả nhiều PDF'
        }
        onBack={onBack}
        toolbarActions={
          entries.length > 0 ? (
            <>
              <ToolbarButton
                icon={Files}
                label="Files"
                active={viewMode === 'files'}
                onClick={() => switchView('files')}
              />
              <ToolbarButton
                icon={LayoutGrid}
                label="Pages"
                active={viewMode === 'pages'}
                onClick={() => switchView('pages')}
              />
              <ToolbarSeparator />
              <ToolbarButton
                icon={ArrowDownAZ}
                label="Sắp A-Z"
                onClick={sortByName}
                disabled={viewMode !== 'files'}
              />
              <ToolbarButton icon={RotateCw} label="Xoay tất" onClick={rotateAll} />
              <ToolbarButton
                icon={FilePlus}
                label="Trang trắng"
                onClick={addBlankPage}
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
                icon={Trash2}
                label="Xoá hết"
                onClick={removeAll}
                destructive
              />
            </>
          ) : undefined
        }
        primaryAction={
          result
            ? { icon: Download, label: 'Tải file gộp', onClick: handleDownload }
            : entries.length > 0
              ? {
                  icon: Combine,
                  label:
                    viewMode === 'files'
                      ? `Gộp ${entries.length} file`
                      : `Gộp ${totalPages} trang`,
                  onClick: handleMerge,
                  disabled: !canMerge,
                  loading: isProcessing,
                }
              : undefined
        }
      />

      {entries.length === 0 && <DropZone onFiles={handleFiles} maxFiles={20} />}

      {entries.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card p-4 elev-surface">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {viewMode === 'files' ? (
                <SortableContext
                  items={entries.map((e) => e.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex flex-wrap items-center gap-y-4">
                    {entries.map((entry, idx) => (
                      <Fragment key={entry.id}>
                        <SortableFileCard
                          entry={entry}
                          thumbnail={thumbnailsRef.current.get(entry.id) ?? null}
                          onDelete={() => removeEntry(entry.id)}
                          onDuplicate={() => duplicateEntry(entry.id)}
                          onRotate={() => rotateEntry(entry.id)}
                          onPreview={() => setPreviewEntryId(entry.id)}
                        />
                        <InlineAddButton
                          onFiles={(files) => handleFilesAt(files, idx + 1)}
                        />
                      </Fragment>
                    ))}
                    <div className="ml-6 mr-1 my-1">
                      <AddFileCard onFiles={handleFiles} multiple />
                    </div>
                  </div>
                </SortableContext>
              ) : (
                <SortableContext
                  items={pageEntries.map((p) => p.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex flex-wrap items-center gap-y-4">
                    {pageEntries.map((p, idx) => (
                      <Fragment key={p.id}>
                        <SortablePageCard
                          entry={p}
                          thumbnail={thumbnailsRef.current.get(p.id) ?? null}
                          onDelete={() => removePageEntry(p.id)}
                          onDuplicate={() => duplicatePageEntry(p.id)}
                          onRotate={() => rotatePageEntry(p.id)}
                          onPreview={() => setPreviewPageId(p.id)}
                        />
                        <InlineAddButton
                          onFiles={(files) => handleFilesAtPagePos(files, idx + 1)}
                        />
                      </Fragment>
                    ))}
                    <div className="ml-6 mr-1 my-1">
                      <AddFileCard
                        onFiles={(files) =>
                          handleFilesAtPagePos(files, pageEntries.length)
                        }
                        multiple
                      />
                    </div>
                  </div>
                </SortableContext>
              )}
            </DndContext>
          </div>

          {isProcessing && <LoadingState variant="inline" label="Đang gộp..." />}
          {error && <ErrorState compact message={error} />}

          {result && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">
                Gộp xong —{' '}
                {viewMode === 'files'
                  ? `${entries.length} file`
                  : `${totalPages} trang`}{' '}
                → 1 PDF
              </p>
            </div>
          )}
        </div>
      )}

      {previewEntry && (
        <PagePreviewModal
          file={previewEntry.file}
          pageNum={1}
          title={previewEntry.file.name}
          subtitle={(() => {
            const displayAngle = ((previewEntry.rotation % 360) + 360) % 360;
            const parts = [`${previewEntry.pageCount} trang`];
            if (displayAngle !== 0) parts.push(`Xoay ${displayAngle}°`);
            return parts.join(' · ');
          })()}
          rotation={previewEntry.rotation}
          onClose={() => setPreviewEntryId(null)}
        />
      )}
      {previewPage && previewPageFile && (
        <PagePreviewModal
          file={previewPageFile}
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

// ─── Sortable File Card (Files view) ─────────────────────────

function SortableFileCard({
  entry,
  thumbnail,
  onDelete,
  onDuplicate,
  onRotate,
  onPreview,
}: {
  entry: FileEntry;
  thumbnail: HTMLCanvasElement | null;
  onDelete: () => void;
  onDuplicate: () => void;
  onRotate: () => void;
  onPreview: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/item relative m-1 box-border flex h-[302px] w-[228px] cursor-move flex-col items-center gap-3 rounded-lg bg-primary/5 px-1 py-3 transition-[color,background-color,border-color] duration-150 ease-in-out hover:bg-primary/10"
      {...attributes}
      {...listeners}
    >
      <CardHoverActions
        onPreview={onPreview}
        onDuplicate={onDuplicate}
        onRotate={onRotate}
        onDelete={onDelete}
      />

      <div className="flex h-[220px] w-[156px] items-center justify-center">
        {thumbnail ? (
          <canvas
            ref={(el) => {
              if (el && thumbnail) {
                el.width = thumbnail.width;
                el.height = thumbnail.height;
                const ctx = el.getContext('2d');
                if (ctx) ctx.drawImage(thumbnail, 0, 0);
              }
            }}
            className="max-h-full max-w-full rounded border border-border/60 bg-background"
            style={getRotationStyle(entry.rotation, { display: 'block' })}
          />
        ) : entry.loading ? (
          <Skeleton className="h-full w-full rounded" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded border border-border/60 bg-muted/30">
            <span className="text-xs text-muted-foreground">PDF</span>
          </div>
        )}
        {entry.pageCount > 1 && !entry.loading && (
          <div className="absolute -left-1 top-4 -z-10 h-[210px] w-[150px] rounded border border-border/50 bg-muted/40" />
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-0.5 px-2">
        <p className="max-w-full truncate px-2 text-center text-xs font-medium text-foreground">
          {entry.file.name}
        </p>
        {(() => {
          const displayAngle = ((entry.rotation % 360) + 360) % 360;
          return (
            <p className="text-[11px] font-medium text-foreground/70">
              {entry.loading ? '...' : `${entry.pageCount} trang`}
              {displayAngle !== 0 && (
                <span className="ml-1 text-primary">· {displayAngle}°</span>
              )}
            </p>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Sortable Page Card (Pages view) ─────────────────────────

function SortablePageCard({
  entry,
  thumbnail,
  onDelete,
  onDuplicate,
  onRotate,
  onPreview,
}: {
  entry: PageEntry;
  thumbnail: HTMLCanvasElement | null;
  onDelete: () => void;
  onDuplicate: () => void;
  onRotate: () => void;
  onPreview: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/item relative m-1 box-border flex h-[302px] w-[228px] cursor-move flex-col items-center gap-3 rounded-lg bg-primary/5 px-1 py-3 transition-[color,background-color,border-color] duration-150 ease-in-out hover:bg-primary/10"
      {...attributes}
      {...listeners}
    >
      <CardHoverActions
        onPreview={onPreview}
        onDuplicate={onDuplicate}
        onRotate={onRotate}
        onDelete={onDelete}
      />

      <div className="flex h-[220px] w-[156px] items-center justify-center">
        {thumbnail ? (
          <canvas
            ref={(el) => {
              if (el && thumbnail) {
                el.width = thumbnail.width;
                el.height = thumbnail.height;
                const ctx = el.getContext('2d');
                if (ctx) ctx.drawImage(thumbnail, 0, 0);
              }
            }}
            className="max-h-full max-w-full rounded border border-border/60 bg-background"
            style={getRotationStyle(entry.rotation, { display: 'block' })}
          />
        ) : entry.loading ? (
          <Skeleton className="h-full w-full rounded" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded border border-border/60 bg-muted/30">
            <span className="text-xs text-muted-foreground">...</span>
          </div>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-0.5 px-2">
        <p className="max-w-full truncate px-2 text-center text-xs font-medium text-foreground">
          {entry.sourceFileName}
        </p>
        {(() => {
          const displayAngle = ((entry.rotation % 360) + 360) % 360;
          return (
            <p className="text-[11px] font-medium text-foreground/70">
              trang {entry.pageNum}
              {displayAngle !== 0 && (
                <span className="ml-1 text-primary">· {displayAngle}°</span>
              )}
            </p>
          );
        })()}
      </div>
    </div>
  );
}
