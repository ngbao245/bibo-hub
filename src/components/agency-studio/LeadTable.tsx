// ============================================================
// LeadTable — Paginated lead list với checkbox selection
// ============================================================

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailX, ExternalLink, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { InlineEditCell } from './InlineEditCell';
import { useUpdateLeadMutation, LEAD_STATUSES } from '@/api/agency-studio/leads';
import type { Lead, LeadStatus } from '@/api/agency-studio/leads';

const STATUS_COLORS: Record<LeadStatus, string> = {
  New: 'bg-primary/10 text-primary',
  Contacted: 'bg-warning/10 text-warning',
  Interested: 'bg-success/10 text-success',
  Won: 'bg-success/20 text-success',
  Lost: 'bg-muted text-muted-foreground',
};

interface Props {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onPageChange: (page: number) => void;
  onEdit: (lead: Lead) => void;
  /** Index của row đang được highlight qua keyboard j/k. -1 = không highlight. */
  activeIndex?: number;
}

export default function LeadTable({
  leads,
  total,
  page,
  pageSize,
  isLoading,
  isError,
  error,
  onRetry,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onPageChange,
  onEdit,
  activeIndex = -1,
}: Props) {
  const navigate = useNavigate();
  const updateMut = useUpdateLeadMutation();
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const totalPages = Math.ceil(total / pageSize);

  // Tính state của header checkbox từ 3 trạng thái:
  //   - all: mọi lead trong page hiện tại đã select → checked
  //   - some: 1 số select → indeterminate (không phải checked/unchecked)
  //   - none: 0 → unchecked
  // Indeterminate là DOM property, không phải attribute → set qua ref.
  const selectedInPage = leads.filter((l) => selectedIds.has(l.id)).length;
  const allSelected = leads.length > 0 && selectedInPage === leads.length;
  const someSelected = selectedInPage > 0 && selectedInPage < leads.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  async function handleUpdateField(id: string, field: 'status' | 'company', value: string) {
    try {
      await updateMut.mutateAsync({
        id,
        [field]: field === 'company' ? (value.trim() || null) : value,
      } as Parameters<typeof updateMut.mutateAsync>[0]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    }
  }

  if (isLoading) {
    return (
      <LoadingState
        variant="skeleton"
        count={6}
        layout="list"
        itemClassName="h-10 w-full"
      />
    );
  }

  if (isError) {
    return <ErrorState message={error?.message ?? 'Load failed'} onRetry={onRetry} />;
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Chưa có lead nào"
        description="Thêm lead đầu tiên hoặc import từ CSV để bắt đầu."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="w-8 px-3 py-2">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => {
                    // Nếu đang indeterminate → click sẽ toggle sang checked
                    // (chọn tất cả trong page), giống pattern Gmail/Airtable.
                    const shouldSelectAll = someSelected ? true : e.target.checked;
                    onToggleAll(leads.map((l) => l.id), shouldSelectAll);
                  }}
                  className="cursor-pointer accent-primary"
                  title={someSelected ? `${selectedInPage}/${leads.length} đã chọn — click để chọn hết` : allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả trong trang'}
                />
              </th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Email</th>
              <th className="hidden px-3 py-2 md:table-cell">Công ty</th>
              <th className="px-3 py-2">Status</th>
              <th className="hidden px-3 py-2 lg:table-cell">Tags</th>
              <th className="w-8 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, idx) => (
              <tr
                key={lead.id}
                className={cn(
                  'border-b border-border transition-colors hover:bg-muted/30',
                  selectedIds.has(lead.id) && 'bg-primary/5',
                  activeIndex === idx && 'bg-primary/10 outline outline-1 outline-primary/40',
                )}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => onToggleSelect(lead.id)}
                    className="cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-left hover:text-primary"
                    onClick={() => navigate(`/agency-studio/leads/${lead.id}`)}
                  >
                    <span className="font-medium text-foreground">{lead.full_name}</span>
                    {lead.unsubscribed && (
                      <MailX className="h-3 w-3 text-destructive shrink-0" />
                    )}
                  </button>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{lead.email}</td>
                <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                  <InlineEditCell
                    kind="text"
                    value={lead.company ?? ''}
                    placeholder="—"
                    pending={updateMut.isPending && updateMut.variables?.id === lead.id}
                    onSave={(v) => handleUpdateField(lead.id, 'company', v)}
                  />
                </td>
                <td className="px-3 py-2">
                  <InlineEditCell<LeadStatus>
                    kind="select"
                    value={lead.status}
                    options={LEAD_STATUSES}
                    pending={updateMut.isPending && updateMut.variables?.id === lead.id}
                    renderDisplay={(v) => (
                      <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', STATUS_COLORS[v])}>
                        {v}
                      </span>
                    )}
                    onSave={(v) => handleUpdateField(lead.id, 'status', v)}
                  />
                </td>
                <td className="hidden px-3 py-2 lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                    {lead.tags.length > 3 && (
                      <span className="text-muted-foreground">+{lead.tags.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onEdit(lead)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Chỉnh sửa"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{total} leads</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
              className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-40"
            >
              Prev
            </button>
            <span>{page + 1} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
              className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}