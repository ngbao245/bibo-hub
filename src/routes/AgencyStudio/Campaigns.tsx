// ============================================================
// Campaigns list page
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, XCircle, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { ConfirmDialog } from '@/components/agency-studio/ConfirmDialog';
import { useCampaignsQuery, useCancelCampaignMutation, type Campaign, type CampaignStatus } from '@/api/agency-studio/campaigns';
import { useAgencyStudioStore } from '@/stores/agencyStudioStore';

const STATUS_COLORS: Record<CampaignStatus, string> = {
  Draft: 'bg-muted text-muted-foreground',
  Sending: 'bg-primary/10 text-primary',
  Completed: 'bg-success/10 text-success',
  Failed: 'bg-destructive/10 text-destructive',
  Cancelled: 'bg-muted text-muted-foreground',
  Scheduled: 'bg-warning/10 text-warning',
};

export default function Campaigns() {
  const navigate = useNavigate();
  const { resetWizard } = useAgencyStudioStore();
  const query = useCampaignsQuery();
  const cancelMut = useCancelCampaignMutation();
  const [cancelTarget, setCancelTarget] = useState<Campaign | null>(null);

  function handleNewCampaign() {
    resetWizard();
    navigate('/agency-studio/campaigns/new');
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    try {
      await cancelMut.mutateAsync(cancelTarget.id);
      toast.success('Đã huỷ campaign');
      setCancelTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Huỷ thất bại');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold text-foreground">Campaigns</h1>
        <Button size="sm" onClick={handleNewCampaign} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          New campaign
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {query.isLoading && (
          <LoadingState variant="skeleton" count={5} layout="list" itemClassName="h-16 w-full" />
        )}
        {query.isError && (
          <ErrorState message={query.error instanceof Error ? query.error.message : 'Load failed'} onRetry={() => query.refetch()} />
        )}
        {!query.isLoading && !query.isError && (
          (query.data ?? []).length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Chưa có campaign nào"
              description="Tạo campaign đầu tiên để bắt đầu outreach."
              action={<Button onClick={handleNewCampaign} className="gap-1"><Plus className="h-3.5 w-3.5" />New campaign</Button>}
            />
          ) : (
            <div className="space-y-2">
              {(query.data ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.total_leads} leads · {c.sent_count} sent · {c.failed_count} failed
                      {c.sent_at && ` · ${new Date(c.sent_at).toLocaleDateString('vi-VN')}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', STATUS_COLORS[c.status])}>
                      {c.status}
                    </span>
                    {(c.status === 'Draft' || c.status === 'Scheduled') && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(c)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Huỷ campaign"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(v) => { if (!v) setCancelTarget(null); }}
        title={cancelTarget ? `Huỷ campaign "${cancelTarget.name}"?` : 'Huỷ campaign?'}
        description="Campaign sẽ chuyển sang trạng thái Cancelled và không thể gửi lại."
        confirmLabel="Huỷ campaign"
        cancelLabel="Giữ nguyên"
        variant="destructive"
        loading={cancelMut.isPending}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}