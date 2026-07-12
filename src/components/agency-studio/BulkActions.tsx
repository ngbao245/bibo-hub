// ============================================================
// BulkActions — Bar hiện khi user select nhiều leads
// ============================================================

import { useState } from 'react';
import { Trash2, RefreshCw, Tag, Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useBulkDeleteLeadsMutation,
  useRestoreLeadsMutation,
  useBulkUpdateStatusMutation,
  useBulkAddTagMutation,
  useAllLeadsMatchingFilter,
  LEAD_STATUSES,
  type Lead,
  type LeadStatus,
} from '@/api/agency-studio/leads';
import { useAgencyStudioStore } from '@/stores/agencyStudioStore';
import { LoadingState } from '@/components/shared';
import { ConfirmDialog } from './ConfirmDialog';
import { createUndoableDelete } from '@/lib/agency-studio/undo';

interface Props {
  selectedIds: string[];
  onDone: () => void;
}

/** Export selected leads → CSV client-side (đọc data trong store nếu có). */
function exportSelectedLeadsCSV(leads: Lead[]) {
  const header = 'full_name,email,company,phone,website,status,tags';
  const rows = leads.map((l) =>
    [l.full_name, l.email, l.company ?? '', l.phone ?? '', l.website ?? '', l.status, l.tags.join(';')]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-selected-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkActions({ selectedIds, onDone }: Props) {
  const deleteMut = useBulkDeleteLeadsMutation();
  const restoreMut = useRestoreLeadsMutation();
  const updateMut = useBulkUpdateStatusMutation();
  const addTagMut = useBulkAddTagMutation();
  const { leadFilters } = useAgencyStudioStore();

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [statusValue, setStatusValue] = useState<LeadStatus>('Contacted');
  const [tagInput, setTagInput] = useState('');
  const [tagMode, setTagMode] = useState(false);

  // Export selected — load full leads matching (không chỉ page hiện tại)
  // rồi filter by selectedIds. Enabled=false → chỉ fetch khi click button.
  const [exportRequested, setExportRequested] = useState(false);
  const exportQuery = useAllLeadsMatchingFilter(leadFilters, exportRequested);

  const undo = createUndoableDelete({
    onDelete: async (ids) => {
      const result = await deleteMut.mutateAsync(ids);
      return result.ids;
    },
    onRestore: async (ids) => {
      await restoreMut.mutateAsync(ids);
    },
    labels: {
      success: (n) => `Đã xoá ${n} lead`,
    },
  });

  async function handleConfirmDelete() {
    setConfirmDeleteOpen(false);
    await undo.deleteWithUndo(selectedIds);
    onDone();
  }

  async function handleUpdateStatus() {
    try {
      await updateMut.mutateAsync({ ids: selectedIds, status: statusValue });
      toast.success(`Đã cập nhật status cho ${selectedIds.length} lead`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    }
  }

  async function handleApplyTag() {
    const tag = tagInput.trim();
    if (!tag) { toast.error('Nhập tag trước'); return; }
    try {
      await addTagMut.mutateAsync({ ids: selectedIds, tag });
      toast.success(`Đã gán tag "${tag}" cho ${selectedIds.length} lead`);
      setTagInput('');
      setTagMode(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gán tag thất bại');
    }
  }

  async function handleExportSelected() {
    setExportRequested(true);
    const data = await exportQuery.refetch();
    const leads = (data.data ?? []).filter((l) => selectedIds.includes(l.id));
    if (leads.length === 0) {
      toast.error('Không tìm thấy lead nào để export');
      return;
    }
    exportSelectedLeadsCSV(leads);
    toast.success(`Đã export ${leads.length} lead`);
  }

  const isPending = deleteMut.isPending || updateMut.isPending || addTagMut.isPending;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs">
        <span className="font-medium text-foreground">{selectedIds.length} đã chọn</span>

        {/* Bulk update status */}
        <div className="flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value as LeadStatus)}
            className="border border-border bg-background px-2 py-1 text-xs focus:outline-none"
          >
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={handleUpdateStatus} disabled={isPending}>
            {updateMut.isPending ? <LoadingState variant="inline" label="" /> : 'Cập nhật status'}
          </Button>
        </div>

        {/* Apply tag */}
        {tagMode ? (
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyTag();
                if (e.key === 'Escape') { setTagMode(false); setTagInput(''); }
              }}
              placeholder="tag name"
              className="h-7 w-32 text-xs"
            />
            <Button size="sm" variant="outline" onClick={handleApplyTag} disabled={isPending || !tagInput.trim()}>
              {addTagMut.isPending ? <LoadingState variant="inline" label="" /> : 'Áp dụng'}
            </Button>
            <button type="button" onClick={() => { setTagMode(false); setTagInput(''); }} className="text-muted-foreground hover:text-foreground">
              Huỷ
            </button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setTagMode(true)} disabled={isPending} className="gap-1">
            <Tag className="h-3.5 w-3.5" />
            Gán tag
          </Button>
        )}

        {/* Export selected */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportSelected}
          disabled={exportQuery.isFetching}
          className="gap-1"
        >
          {exportQuery.isFetching ? (
            <LoadingState variant="inline" label="Đang export" />
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              Export selected
            </>
          )}
        </Button>

        {/* Bulk delete */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={isPending}
          className="gap-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Xoá
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Xoá ${selectedIds.length} lead?`}
        description="Có thể hoàn tác trong 5 giây sau khi xoá."
        confirmLabel="Xoá"
        variant="destructive"
        loading={deleteMut.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}