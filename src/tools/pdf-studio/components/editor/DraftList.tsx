// ============================================================
// PDF Studio Edit PDF — Draft list (recent drafts + upload)
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { Upload, Trash2, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { listDrafts, deleteDraft, checkStorageQuota } from '../../lib/editor-draft-store';
import type { DraftMeta } from '../../lib/editor-draft-store';
import { toast } from 'sonner';

interface DraftListProps {
  onUpload: (file: File) => void;
  onOpenDraft: (draftId: string) => void;
}

export function DraftList({ onUpload, onOpenDraft }: DraftListProps) {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listDrafts();
      setDrafts(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Khong the doc danh sach draft.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Chi chap nhan file PDF.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File vuot qua 50 MB.');
      return;
    }
    onUpload(file);
    e.target.value = '';
  };

  const handleDelete = async (draftId: string, filename: string) => {
    if (!window.confirm(`Xoa draft "${filename}"? Hanh dong nay khong the hoan tac.`)) return;
    try {
      await deleteDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
      toast.success('Da xoa draft.');
    } catch {
      toast.error('Khong the xoa draft.');
    }
  };

  const handleQuotaCheck = async () => {
    const { percentUsed } = await checkStorageQuota();
    if (percentUsed > 80) {
      toast.warning(`Bo nho da dung ${Math.round(percentUsed)}%. Xoa draft cu de giai phong.`);
    }
  };

  useEffect(() => {
    handleQuotaCheck();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message={error} onRetry={loadDrafts} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Upload area */}
      <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
        <Upload className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Upload file PDF moi</span>
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={handleFileChange}
        />
      </label>

      {/* Draft list */}
      {drafts.length === 0 ? (
        <EmptyState
          icon={FileEdit}
          title="Chua co ban nhap nao"
          description="Upload mot file PDF de bat dau chinh sua."
        />
      ) : (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Draft gan day</h3>
          {drafts.map((d) => (
            <div
              key={d.draftId}
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
            >
              {/* Thumbnail */}
              <div className="w-12 h-16 bg-muted border border-border rounded-sm overflow-hidden flex items-center justify-center shrink-0">
                {d.thumbnailDataUrl ? (
                  <img src={d.thumbnailDataUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <FileEdit className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{d.filename}</p>
                <p className="text-[11px] text-muted-foreground">
                  {d.totalPages} trang — Luu {new Date(d.updatedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>

              {/* Actions */}
              <Button variant="ghost" size="sm" onClick={() => onOpenDraft(d.draftId)}>
                Mo
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(d.draftId, d.filename)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
