// ============================================================
// PDF Studio Edit PDF — Manage Pages (reorder, delete, crop)
// ============================================================
// Creates working revisions via pdf-lib without mutating original.
// Overlay stays attached via stable page identity.
// ============================================================

import { useState, useCallback } from 'react';
import { ArrowUp, ArrowDown, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PageInfo {
  pageId: string;
  index: number; // current position (0-based)
  originalIndex: number;
}

interface ManagePagesProps {
  totalPages: number;
  currentPage: number;
  onApplyRevision: (newPdfBlob: Blob, pageMapping: PageInfo[]) => void;
  onClose: () => void;
  getWorkingRevision: () => Blob | null;
  getOriginalPdf: () => Blob;
}

export function ManagePages({
  totalPages,
  currentPage,
  onApplyRevision,
  onClose,
  getWorkingRevision,
  getOriginalPdf,
}: ManagePagesProps) {
  // Build initial page list
  const [pages, setPages] = useState<PageInfo[]>(() =>
    Array.from({ length: totalPages }, (_, i) => ({
      pageId: `page-${i}`,
      index: i,
      originalIndex: i,
    })),
  );
  const [processing, setProcessing] = useState(false);

  const moveUp = useCallback((idx: number) => {
    if (idx <= 0) return;
    setPages((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((p, i) => ({ ...p, index: i }));
    });
  }, []);

  const moveDown = useCallback((idx: number) => {
    if (idx >= pages.length - 1) return;
    setPages((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((p, i) => ({ ...p, index: i }));
    });
  }, [pages.length]);

  const deletePage = useCallback((idx: number) => {
    if (pages.length <= 1) {
      toast.error('Khong the xoa trang cuoi cung.');
      return;
    }
    setPages((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, index: i })));
  }, [pages.length]);

  const applyChanges = useCallback(async () => {
    setProcessing(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const source = getWorkingRevision() ?? getOriginalPdf();
      const srcBytes = await source.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes);
      const newDoc = await PDFDocument.create();

      // Copy pages in new order
      for (const pageInfo of pages) {
        const [copiedPage] = await newDoc.copyPages(srcDoc, [pageInfo.originalIndex]);
        newDoc.addPage(copiedPage);
      }

      const pdfBytes = await newDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      onApplyRevision(blob, pages);
      toast.success('Da cap nhat thu tu trang.');
      onClose();
    } catch (err) {
      toast.error('Loi khi xu ly trang: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setProcessing(false);
    }
  }, [pages, getWorkingRevision, getOriginalPdf, onApplyRevision, onClose]);

  const hasChanges = pages.some((p, i) => p.originalIndex !== i) || pages.length !== totalPages;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">Quan ly trang</h2>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button size="sm" onClick={applyChanges} disabled={processing}>
              {processing ? 'Dang xu ly...' : 'Ap dung'}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Page list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2 max-w-md mx-auto">
          {pages.map((page, idx) => (
            <div
              key={page.pageId}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                page.originalIndex === currentPage - 1 ? 'border-primary/50 bg-primary/5' : 'border-border'
              }`}
            >
              <span className="text-xs font-mono text-muted-foreground w-6 text-center">{idx + 1}</span>
              <div className="flex-1 text-xs text-foreground">
                Trang {page.originalIndex + 1}
                {page.originalIndex !== idx && (
                  <span className="ml-1 text-muted-foreground">(goc: {page.originalIndex + 1})</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  title="Di len"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === pages.length - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  title="Di xuong"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deletePage(idx)}
                  disabled={pages.length <= 1}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30"
                  title="Xoa trang"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer info */}
      <footer className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        {pages.length} trang{hasChanges ? ' (co thay doi chua ap dung)' : ''}
      </footer>
    </div>
  );
}
