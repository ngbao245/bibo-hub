// ============================================================
// Leads page
// ============================================================

import { useState, useDeferredValue, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Download, Search, Keyboard } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LeadTable from '@/components/agency-studio/LeadTable';
import LeadForm from '@/components/agency-studio/LeadForm';
import BulkActions from '@/components/agency-studio/BulkActions';
import ImportDialog from '@/components/agency-studio/ImportDialog';
import { ShortcutHelp } from '@/components/agency-studio/ShortcutHelp';
import {
  useLeadsQuery,
  useAllLeadsMatchingFilter,
  LEAD_STATUSES,
  type Lead,
} from '@/api/agency-studio/leads';
import { useAgencyStudioStore } from '@/stores/agencyStudioStore';
import { useLeadListShortcuts } from '@/lib/agency-studio/shortcuts';

function exportLeadsCSV(leads: Lead[], filenameSuffix = '') {
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
  a.download = `leads${filenameSuffix ? '-' + filenameSuffix : ''}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Leads() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { leadFilters, setLeadFilters, selectedLeadIds, toggleLeadSelection, toggleAllLeads, clearLeadSelection } =
    useAgencyStudioStore();

  const deferredFilters = useDeferredValue(leadFilters);
  const query = useLeadsQuery(deferredFilters, page);

  // Export ALL: chỉ enable khi user click Export (fetch on-demand).
  const [exportRequested, setExportRequested] = useState(false);
  const exportQuery = useAllLeadsMatchingFilter(deferredFilters, exportRequested);

  const leads = query.data?.leads ?? [];

  function handleEdit(lead: Lead) {
    setEditLead(lead);
    setFormOpen(true);
  }

  async function handleExport() {
    if (leads.length === 0) {
      toast.error('Không có lead để export');
      return;
    }
    setExportRequested(true);
    const result = await exportQuery.refetch();
    const all = result.data ?? [];
    if (all.length === 0) {
      toast.error('Không có lead khớp filter');
      return;
    }
    exportLeadsCSV(all, all.length === leads.length ? '' : 'filtered');
    toast.success(`Đã export ${all.length} lead`);
  }

  const openItemAt = useCallback((idx: number) => {
    const l = leads[idx];
    if (l) navigate(`/agency-studio/leads/${l.id}`);
  }, [leads, navigate]);

  const openNewForm = useCallback(() => {
    setEditLead(null);
    setFormOpen(true);
  }, []);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  useLeadListShortcuts({
    itemCount: leads.length,
    activeIndex,
    setActiveIndex,
    onOpenItem: openItemAt,
    onNewItem: openNewForm,
    onFocusSearch: focusSearch,
    onShowHelp: () => setHelpOpen(true),
    onEscape: () => setActiveIndex(-1),
    disabled: formOpen || importOpen || helpOpen,
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold text-foreground">Leads</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setHelpOpen(true)}
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleExport}
            disabled={exportQuery.isFetching}
          >
            <Download className="h-3.5 w-3.5" />
            {exportQuery.isFetching ? 'Đang export...' : 'Export'}
          </Button>
          <Button
            size="sm"
            className="gap-1"
            onClick={openNewForm}
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm lead
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={leadFilters.search}
            onChange={(e) => { setLeadFilters({ search: e.target.value }); setPage(0); }}
            placeholder="Tìm tên, email, công ty..."
            className="pl-7 text-xs"
          />
        </div>
        <select
          value={leadFilters.status || 'all'}
          onChange={(e) => { setLeadFilters({ status: e.target.value === 'all' ? '' : e.target.value }); setPage(0); }}
          className="border border-border bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
        >
          <option value="all">Tất cả</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Bulk actions bar — flex item shrink-0, không đẩy table vì table
          có flex-1 min-h-0 riêng cho scroll. */}
      {selectedLeadIds.size > 0 && (
        <div className="shrink-0">
          <BulkActions
            selectedIds={[...selectedLeadIds]}
            onDone={clearLeadSelection}
          />
        </div>
      )}

      {/* Table — flex-1 min-h-0 để tự scroll khi bulk bar chiếm chỗ.
          min-h-0 quan trọng vì parent là flex column, không có nó
          sẽ giãn theo min-content thay vì scroll. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <LeadTable
          leads={leads}
          total={query.data?.total ?? 0}
          page={page}
          pageSize={20}
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error instanceof Error ? query.error : null}
          onRetry={() => query.refetch()}
          selectedIds={selectedLeadIds}
          onToggleSelect={toggleLeadSelection}
          onToggleAll={toggleAllLeads}
          onPageChange={setPage}
          onEdit={handleEdit}
          activeIndex={activeIndex}
        />
      </div>

      <LeadForm
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditLead(null); }}
        lead={editLead}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}