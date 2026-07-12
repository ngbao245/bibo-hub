// ============================================================
// Templates page — grid cards + editor
// ============================================================

import { useState } from 'react';
import { Plus, Copy, Trash2, Edit2, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import TemplateEditor from '@/components/agency-studio/TemplateEditor';
import { ConfirmDialog } from '@/components/agency-studio/ConfirmDialog';
import {
  useTemplatesQuery,
  useDeleteTemplateMutation,
  useDuplicateTemplateMutation,
  type Template,
} from '@/api/agency-studio/templates';

export default function Templates() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const query = useTemplatesQuery();
  const deleteMut = useDeleteTemplateMutation();
  const duplicateMut = useDuplicateTemplateMutation();

  function openNew() {
    setEditTemplate(null);
    setEditorOpen(true);
  }

  function openEdit(t: Template) {
    setEditTemplate(t);
    setEditorOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success('Đã xoá template');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xoá thất bại');
    }
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicateMut.mutateAsync(id);
      toast.success('Đã duplicate template');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Duplicate thất bại');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold text-foreground">Templates</h1>
        <Button size="sm" onClick={openNew} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          New template
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {query.isLoading && (
          <LoadingState variant="skeleton" count={6} itemClassName="h-32 w-full" />
        )}
        {query.isError && (
          <ErrorState
            message={query.error instanceof Error ? query.error.message : 'Load failed'}
            onRetry={() => query.refetch()}
          />
        )}
        {!query.isLoading && !query.isError && (
          (query.data ?? []).length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Chưa có template nào"
              description="Tạo template đầu tiên để dùng cho campaign."
              action={<Button onClick={openNew} className="gap-1"><Plus className="h-3.5 w-3.5" />Tạo template</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(query.data ?? []).map((t) => (
                <div key={t.id} className="flex flex-col gap-2 border border-border bg-card p-4 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                      {t.category && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{t.category}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => openEdit(t)} className="text-muted-foreground hover:text-foreground" title="Chỉnh sửa">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDuplicate(t.id)} className="text-muted-foreground hover:text-foreground" title="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(t)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Xoá"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground/70">{t.body}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <TemplateEditor
        open={editorOpen}
        onOpenChange={(v) => { setEditorOpen(v); if (!v) setEditTemplate(null); }}
        template={editTemplate}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title={deleteTarget ? `Xoá template "${deleteTarget.name}"?` : 'Xoá template?'}
        description="Template sẽ bị xoá vĩnh viễn. Campaigns đã dùng template này vẫn giữ nội dung."
        confirmLabel="Xoá"
        variant="destructive"
        loading={deleteMut.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}