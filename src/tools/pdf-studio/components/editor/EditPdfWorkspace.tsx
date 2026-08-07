// ============================================================
// PDF Studio Edit PDF — Editor workspace (fully wired)
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, FileOutput, ZoomIn, ZoomOut, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { EditorToolbar } from './EditorToolbar';
import { PdfViewer } from './PdfViewer';
import { EditorThumbnails } from './EditorThumbnails';
import { DraftList } from './DraftList';
import { OverlayLayer } from './OverlayLayer';
import { ContextToolbar } from './ContextToolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { MarkupTools } from './MarkupTools';
import type { MarkupMode } from './MarkupTools';
import { EditTextOverlay } from './EditTextOverlay';
import { OcrPanel } from './OcrPanel';
import { ManagePages } from './ManagePages';
import { saveDraft, getDraft } from '../../lib/editor-draft-store';
import type { DraftData } from '../../lib/editor-draft-store';
import { useEditorStore } from '../../lib/useEditorStore';
import { usePdfStudioStore } from '../../store';
import { detectTextRegions, hasTextLayer } from '../../lib/text-detection';
import { exportPdf } from '../../lib/editor-export';
import { createTextObject, createShapeObject, createSymbolObject } from '../../lib/editor-objects';
import type { ShapeKind, SymbolKind, ViewportTransform } from '../../lib/editor-objects';
import type { TextRegion } from '../../lib/text-detection';
import type { PageLayoutMode } from './PdfViewer';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface EditPdfWorkspaceProps {
  onBack: () => void;
}

type EditorView = 'draft-list' | 'editor';

export function EditPdfWorkspace({ onBack }: EditPdfWorkspaceProps) {
  const [view, setView] = useState<EditorView>('draft-list');
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // Document state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  // originalPdf: immutable blob của file gốc upload (không đổi sau OCR/Manage Pages)
  const [originalPdf, setOriginalPdf] = useState<Blob | null>(null);
  // workingRevision: blob hiện tại sau OCR/Manage Pages (null = giống original)
  const [workingRevision, setWorkingRevision] = useState<Blob | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [layoutMode, setLayoutMode] = useState<PageLayoutMode>('single');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [createdAt, setCreatedAt] = useState<string | null>(null); // ISO
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null); // ISO
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('unsaved');

  // File currently rendered = workingRevision nếu có, else originalPdf
  const file: Blob | null = workingRevision ?? originalPdf;

  // PDF doc reference
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);

  // Edit Text state
  const [textRegions, setTextRegions] = useState<TextRegion[]>([]);
  const [showOcr, setShowOcr] = useState(false);

  // Manage Pages
  const [showManagePages, setShowManagePages] = useState(false);

  // Editor store
  const { objects, selectedIds, addObject, undo, redo, canUndo, canRedo } = useEditorStore();

  // Autosave
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // ─── Viewport transform (from actual page dimensions) ──────

  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });

  // Update page dimensions when page changes
  useEffect(() => {
    if (!pdfDoc || currentPage < 1) return;
    pdfDoc.getPage(currentPage).then((page) => {
      const vp = page.getViewport({ scale: 1 });
      setPageDimensions({ width: vp.width, height: vp.height });
    }).catch(() => { /* ignore */ });
  }, [pdfDoc, currentPage]);

  const getTransform = useCallback((): ViewportTransform => {
    return {
      scale: zoom / 100,
      offsetX: 0,
      offsetY: 0,
      pageWidth: pageDimensions.width,
      pageHeight: pageDimensions.height,
    };
  }, [zoom, pageDimensions]);

  // ─── Draft persistence ─────────────────────────────────────

  const performSave = useCallback(async () => {
    if (!draftId || !originalPdf) return;
    setSaveStatus('saving');
    try {
      const nowIso = new Date().toISOString();
      const data: DraftData = {
        draftId,
        filename,
        originalPdf,             // GIỮ NGUYÊN bản gốc immutable
        workingRevision,          // Track revision riêng
        overlayObjects: JSON.stringify(objects),
        jobState: null,
        createdAt: createdAt ?? nowIso,
        updatedAt: nowIso,
        thumbnailDataUrl: null,
        version: 1,
        totalPages,
        currentPage,
        zoom,
      };
      await saveDraft(data);
      if (!createdAt) setCreatedAt(nowIso);
      setLastSavedAt(nowIso);
      setSaveStatus('saved');
      dirtyRef.current = false;
    } catch {
      setSaveStatus('error');
      toast.error('Luu draft that bai. Kiem tra dung luong trinh duyet.');
    }
  }, [draftId, originalPdf, workingRevision, filename, totalPages, currentPage, zoom, createdAt, objects]);

  const triggerAutosave = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus('unsaved');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      performSave();
    }, 2000);
  }, [performSave]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        performSave();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [performSave]);

  // Trigger autosave khi bất kỳ persistable state đổi (không gate bởi objects.length)
  useEffect(() => {
    if (!draftId) return;
    triggerAutosave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, workingRevision, filename, currentPage, zoom, totalPages, draftId]);

  // ─── Tool actions ──────────────────────────────────────────

  const handleToolSelect = useCallback(async (toolId: string) => {
    setActiveTool(toolId);
    setTextRegions([]);
    setShowOcr(false);

    // Handle undo/redo
    if (toolId === 'undo') {
      if (canUndo()) undo();
      return;
    }
    if (toolId === 'redo') {
      if (canRedo()) redo();
      return;
    }

    // Handle manage pages
    if (toolId === 'manage-pages') {
      setShowManagePages(true);
      return;
    }

    // Handle Edit Text activation
    if (toolId === 'edit-text' && pdfDoc) {
      const hasText = await hasTextLayer(pdfDoc, currentPage - 1);
      if (hasText) {
        const regions = await detectTextRegions(pdfDoc, [currentPage - 1]);
        setTextRegions(regions);
      } else {
        setShowOcr(true);
      }
    }
  }, [pdfDoc, currentPage, canUndo, canRedo, undo, redo]);

  // ─── Stage click for creating objects (coords = doc points, top-left) ──

  const handleStageClick = useCallback((docX: number, docY: number) => {
    if (!activeTool || activeTool === 'move') return;
    const pageId = `page-${currentPage - 1}`;
    const layerOrder = Date.now();

    if (activeTool === 'add-text') {
      const textObj = createTextObject(pageId, docX, docY, layerOrder);
      addObject(textObj);
      toast.success('Text box da tao. (Chinh sua noi dung o panel phai)');
    } else if (activeTool === 'check') {
      addObject(createSymbolObject(pageId, 'check' as SymbolKind, docX, docY, layerOrder));
    } else if (activeTool === 'cross') {
      addObject(createSymbolObject(pageId, 'cross' as SymbolKind, docX, docY, layerOrder));
    } else if (['rectangle', 'ellipse', 'line', 'arrow'].includes(activeTool)) {
      addObject(createShapeObject(pageId, activeTool as ShapeKind, docX, docY, 100, 60, layerOrder));
    }
  }, [activeTool, currentPage, addObject]);

  // ─── Export ────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!originalPdf) return;
    try {
      const result = await exportPdf({
        originalPdf,
        workingRevision,
        objects,
        filename: filename.replace(/\.pdf$/i, '-edited.pdf'),
      });
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Da xuat PDF thanh cong.');
    } catch (err) {
      toast.error('Export that bai: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  }, [originalPdf, workingRevision, objects, filename]);

  // ─── OCR complete ──────────────────────────────────────────

  // OCR replaces the working revision (KHÔNG đụng vào originalPdf)
  const handleOcrComplete = useCallback(async (resultBlob: Blob) => {
    setWorkingRevision(resultBlob);
    setShowOcr(false);
  }, []);

  // ─── Upload / Open draft ───────────────────────────────────

  const handleUpload = useCallback((uploadedFile: File | Blob, filenameOverride?: string) => {
    const id = crypto.randomUUID();
    // Reset editor store TRƯỚC khi set state — tránh leak history/selection cross-draft
    useEditorStore.getState().reset();
    setDraftId(id);
    setFilename(filenameOverride ?? (uploadedFile instanceof File ? uploadedFile.name : 'document.pdf'));
    setOriginalPdf(uploadedFile);
    setWorkingRevision(null);
    setCurrentPage(1);
    setTotalPages(0);
    setZoom(100);
    setCreatedAt(null);
    setLastSavedAt(null);
    setSaveStatus('unsaved');
    setView('editor');
  }, []);

  // Consume pending blob (khi user tới đây từ Merge/Remove/Rotate/Crop workspace)
  useEffect(() => {
    const state = usePdfStudioStore.getState();
    if (state.pendingEditBlob) {
      handleUpload(state.pendingEditBlob, state.pendingEditFilename ?? 'document.pdf');
      state.consumePendingEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDraft = useCallback(async (id: string) => {
    try {
      const data = await getDraft(id);
      if (!data) {
        toast.error('Draft khong tim thay.');
        return;
      }
      // Reset TRƯỚC khi load — clear history/selection của session cũ
      useEditorStore.getState().reset();

      setDraftId(data.draftId);
      setFilename(data.filename);
      setOriginalPdf(data.originalPdf);
      setWorkingRevision(data.workingRevision);
      setCurrentPage(data.currentPage || 1);
      setTotalPages(data.totalPages || 0);
      setZoom(data.zoom || 100);
      setCreatedAt(data.createdAt);
      setLastSavedAt(data.updatedAt);
      setSaveStatus('saved');
      // Restore objects — setObjects đã reset history/selection tự động
      if (data.overlayObjects) {
        try {
          const parsed = JSON.parse(data.overlayObjects);
          useEditorStore.getState().setObjects(parsed);
        } catch {
          /* ignore parse error */
        }
      }
      setView('editor');
    } catch {
      toast.error('Khong the mo draft.');
    }
  }, []);

  const handleTotalPagesChange = useCallback((total: number) => {
    setTotalPages(total);
    if (draftId && total > 0) setTimeout(() => triggerAutosave(), 500);
  }, [draftId, triggerAutosave]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 25, 400)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 25, 25)), []);
  const handleError = useCallback((msg: string) => toast.error(msg), []);

  // ─── Keyboard shortcuts ────────────────────────────────────

  useEffect(() => {
    if (view !== 'editor') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); handleZoomIn(); }
      else if (e.ctrlKey && e.key === '-') { e.preventDefault(); handleZoomOut(); }
      else if (e.ctrlKey && e.key === 's') { e.preventDefault(); performSave(); }
      else if (e.ctrlKey && e.key === 'z') { e.preventDefault(); if (canUndo()) undo(); }
      else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); if (canRedo()) redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          useEditorStore.getState().deleteObjects(selectedIds);
        }
      }
      else if (e.key === 'Escape') { useEditorStore.getState().clearSelection(); setActiveTool(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, handleZoomIn, handleZoomOut, performSave, canUndo, canRedo, undo, redo, selectedIds]);

  // ─── Markup mode mapping ───────────────────────────────────

  const markupMode: MarkupMode = (['highlight', 'pencil', 'eraser'].includes(activeTool ?? ''))
    ? (activeTool as MarkupMode)
    : null;

  // ─── Draft List view ───────────────────────────────────────

  if (view === 'draft-list') {
    return (
      <div className="flex h-screen flex-col bg-background">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} title="Quay lai Toolbox">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileOutput className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold text-foreground">Edit PDF</h1>
        </header>
        <main className="flex-1 overflow-y-auto">
          <DraftList onUpload={handleUpload} onOpenDraft={handleOpenDraft} />
        </main>
      </div>
    );
  }

  // ─── Editor view ───────────────────────────────────────────

  const transform = getTransform();
  const pageId = `page-${currentPage - 1}`;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border px-4 py-1.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setView('draft-list')} title="Quay lai danh sach">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FileOutput className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-foreground truncate max-w-[200px]">{filename}</span>
      </header>

      {/* Toolbar */}
      <EditorToolbar activeTool={activeTool} onToolSelect={handleToolSelect} />

      {/* Context toolbar */}
      <ContextToolbar />

      {/* OCR Panel */}
      {showOcr && file && (
        <OcrPanel
          file={file}
          filename={filename}
          onOcrComplete={handleOcrComplete}
          onCancel={() => setShowOcr(false)}
        />
      )}

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Thumbnail sidebar */}
        {sidebarOpen && (
          <EditorThumbnails
            pdfDoc={pdfDoc}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageSelect={handlePageChange}
          />
        )}

        {/* Canvas + overlays (overlays are children → share canvas origin) */}
        <PdfViewer
          file={file}
          currentPage={currentPage}
          zoom={zoom}
          layoutMode={layoutMode}
          textSelectable={activeTool === null}
          onPageChange={handlePageChange}
          onTotalPagesChange={handleTotalPagesChange}
          onError={handleError}
          onDocLoaded={setPdfDoc}
          onStageClick={handleStageClick}
        >
          {/* OverlayLayer LUÔN render objects đã commit — user thấy ngay
              highlight/pencil/rectangle... sau khi thả chuột. Trong markup mode
              OverlayLayer inert (pointer-events none), MarkupTools capture drag. */}
          {pdfDoc && (
            <OverlayLayer
              objects={objects}
              pageId={pageId}
              transform={transform}
              activeTool={activeTool}
            />
          )}

          {/* Markup drawing layer — z-index cao hơn OverlayLayer để capture drag */}
          {markupMode && (
            <MarkupTools
              mode={markupMode}
              transform={transform}
              pageId={pageId}
              color="#ffcc00"
              strokeWidth={3}
            />
          )}

          {/* Edit Text regions */}
          {activeTool === 'edit-text' && textRegions.length > 0 && (
            <EditTextOverlay
              regions={textRegions}
              transform={transform}
              active={true}
            />
          )}
        </PdfViewer>

        {/* Properties panel */}
        <PropertiesPanel />
      </div>

      {/* Manage Pages overlay */}
      {showManagePages && originalPdf && (
        <ManagePages
          totalPages={totalPages}
          currentPage={currentPage}
          onApplyRevision={(blob, pageMapping) => {
            // Remap objects.pageId theo thứ tự page mới.
            // pageMapping[i].originalIndex = index gốc; index i = index mới.
            const remap = new Map<string, string>();
            pageMapping.forEach((p, newIdx) => {
              remap.set(`page-${p.originalIndex}`, `page-${newIdx}`);
            });
            const currentObjects = useEditorStore.getState().objects;
            const remappedObjects = currentObjects
              .filter((o) => remap.has(o.pageId)) // drop orphan (page bị xoá)
              .map((o) => ({ ...o, pageId: remap.get(o.pageId)! }));
            useEditorStore.getState().setObjects(remappedObjects);
            setWorkingRevision(blob);
            setTotalPages(pageMapping.length);
            setCurrentPage(Math.min(currentPage, pageMapping.length));
            setShowManagePages(false);
          }}
          onClose={() => setShowManagePages(false)}
          getWorkingRevision={() => workingRevision}
          getOriginalPdf={() => originalPdf}
        />
      )}

      {/* Status bar */}
      <footer className="flex items-center gap-4 border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hover:text-foreground transition-colors" title={sidebarOpen ? 'An thumbnails' : 'Hien thumbnails'}>
          {sidebarOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
        </button>

        <span>Trang {totalPages > 0 ? currentPage : '—'} / {totalPages || '—'}</span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)} className="px-1 hover:text-foreground disabled:opacity-30">&lt;</button>
            <button disabled={currentPage >= totalPages} onClick={() => handlePageChange(currentPage + 1)} className="px-1 hover:text-foreground disabled:opacity-30">&gt;</button>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button onClick={handleZoomOut} className="hover:text-foreground" title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="w-10 text-center">{zoom}%</span>
          <button onClick={handleZoomIn} className="hover:text-foreground" title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></button>
        </div>

        <button onClick={() => setLayoutMode(layoutMode === 'single' ? 'continuous' : 'single')} className="hover:text-foreground" title={layoutMode === 'single' ? 'Cuon lien tuc' : 'Mot trang'}>
          {layoutMode === 'single' ? '1P' : '∞'}
        </button>

        <span className="ml-auto">
          {saveStatus === 'saved' && lastSavedAt &&
            `Da luu ${new Date(lastSavedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
          {saveStatus === 'unsaved' && 'Chua luu'}
          {saveStatus === 'saving' && 'Dang luu...'}
          {saveStatus === 'error' && 'Loi luu!'}
        </span>

        <Button variant="outline" size="sm" className="h-6 text-xs" disabled={!originalPdf || totalPages === 0} onClick={handleExport}>
          Export PDF
        </Button>
      </footer>
    </div>
  );
}
