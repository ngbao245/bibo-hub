// ============================================================
// LeadDetail — Profile + Notes + Email History + Activity Timeline
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MailX, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/shared';
import {
  useLeadQuery,
  useUpdateLeadMutation,
  LEAD_STATUSES,
  type LeadStatus,
} from '@/api/agency-studio/leads';
import { useEmailLogsQuery } from '@/api/agency-studio/emailLogs';

type TabId = 'profile' | 'email-history' | 'timeline';

const STATUS_COLORS: Record<LeadStatus, string> = {
  New: 'bg-primary/10 text-primary',
  Contacted: 'bg-warning/10 text-warning',
  Interested: 'bg-success/10 text-success',
  Won: 'bg-success/20 text-success',
  Lost: 'bg-muted text-muted-foreground',
};

const LOG_STATUS_COLOR: Record<string, string> = {
  queued: 'text-muted-foreground',
  sent: 'text-primary',
  delivered: 'text-success',
  failed: 'text-destructive',
  bounced: 'text-destructive',
  complained: 'text-warning',
};

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('profile');

  const leadQuery = useLeadQuery(id ?? '');
  const emailLogsQuery = useEmailLogsQuery({ leadId: id });
  const updateMut = useUpdateLeadMutation();

  const [notes, setNotes] = useState<string>('');
  const [notesDirty, setNotesDirty] = useState(false);

  // Sync notes state từ server data khi lead thay đổi hoặc reload data,
  // NHƯNG chỉ overwrite khi user chưa dirty (đang typing) để không mất
  // input. useEffect chạy sau render, không update trong body → React
  // strict mode không warn.
  useEffect(() => {
    if (leadQuery.data && !notesDirty) {
      setNotes(leadQuery.data.notes ?? '');
    }
  }, [leadQuery.data, notesDirty]);

  async function handleSaveNotes() {
    if (!id) return;
    try {
      await updateMut.mutateAsync({ id, notes });
      toast.success('Đã lưu notes');
      setNotesDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu notes thất bại');
    }
  }

  async function handleStatusChange(status: LeadStatus) {
    if (!id) return;
    try {
      await updateMut.mutateAsync({ id, status });
      toast.success('Đã cập nhật status');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    }
  }

  if (leadQuery.isLoading) {
    return (
      <div className="p-6">
        <LoadingState
          variant="skeleton"
          count={3}
          layout="list"
          itemClassName="h-8 w-full first:w-48 [&:nth-child(2)]:w-32 last:h-32"
        />
      </div>
    );
  }

  if (leadQuery.isError || !leadQuery.data) {
    return (
      <div className="p-6">
        <ErrorState
          message={leadQuery.error instanceof Error ? leadQuery.error.message : 'Load failed'}
          onRetry={() => leadQuery.refetch()}
        />
      </div>
    );
  }

  const lead = leadQuery.data;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/agency-studio/leads')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center gap-3">
          {/* Avatar initials */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {lead.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{lead.full_name}</span>
              {lead.unsubscribed && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <MailX className="h-3 w-3" />
                  Unsubscribed
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{lead.email}</span>
          </div>
        </div>
        {/* Status select */}
        <select
          value={lead.status}
          onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
          className={`rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none ${STATUS_COLORS[lead.status]}`}
        >
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Unsubscribe banner */}
      {lead.unsubscribed && (
        <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          Lead này đã unsubscribe. Sẽ không được đưa vào campaign mới.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border bg-muted/20">
        {([['profile', 'Profile'], ['email-history', 'Email History'], ['timeline', 'Activity']] as [TabId, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'profile' && (
          <div className="max-w-lg space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Họ tên" value={lead.full_name} />
              <Field label="Email" value={lead.email} />
              <Field label="Công ty" value={lead.company ?? '—'} />
              <Field label="Phone" value={lead.phone ?? '—'} />
              <Field label="Website" value={lead.website ?? '—'} />
              <Field label="Tags" value={lead.tags.join(', ') || '—'} />
              <Field label="Created" value={new Date(lead.created_at).toLocaleDateString('vi-VN')} />
              <Field label="Updated" value={new Date(lead.updated_at).toLocaleDateString('vi-VN')} />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
                rows={5}
                placeholder="Ghi chú về lead..."
                className="w-full resize-none border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
              {notesDirty && (
                <Button size="sm" onClick={handleSaveNotes} disabled={updateMut.isPending} className="gap-1">
                  {updateMut.isPending ? <LoadingState variant="inline" label="Đang lưu" /> : (
                    <><Save className="h-3.5 w-3.5" />Lưu notes</>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {tab === 'email-history' && (
          <div className="space-y-2">
            {emailLogsQuery.isLoading && (
              <LoadingState variant="skeleton" count={3} layout="list" itemClassName="h-12 w-full" />
            )}
            {emailLogsQuery.isError && (
              <ErrorState
                message="Không load được email history"
                onRetry={() => emailLogsQuery.refetch()}
              />
            )}
            {!emailLogsQuery.isLoading && !emailLogsQuery.isError && (
              (emailLogsQuery.data?.logs ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa có email nào gửi tới lead này.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-2">Subject</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Opened</th>
                      <th className="px-2 py-2">Clicked</th>
                      <th className="px-2 py-2">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(emailLogsQuery.data?.logs ?? []).map((log) => (
                      <tr key={log.id} className="border-b border-border">
                        <td className="px-2 py-2 text-foreground">{log.subject}</td>
                        <td className={`px-2 py-2 font-medium ${LOG_STATUS_COLOR[log.status] ?? 'text-foreground'}`}>{log.status}</td>
                        <td className="px-2 py-2">{log.opened_at ? <span className="text-success">Yes</span> : '—'}</td>
                        <td className="px-2 py-2">{log.clicked_at ? <span className="text-success">Yes</span> : '—'}</td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {log.sent_at ? new Date(log.sent_at).toLocaleDateString('vi-VN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        )}

        {tab === 'timeline' && (
          <div className="space-y-3 text-xs">
            <TimelineItem
              date={lead.created_at}
              label="Lead được tạo"
              sub={`Status: ${lead.status}`}
            />
            {(emailLogsQuery.data?.logs ?? []).map((log) => (
              <div key={log.id}>
                <TimelineItem date={log.sent_at ?? log.created_at} label={`Email gửi: ${log.subject}`} sub={`Status: ${log.status}`} />
                {log.opened_at && <TimelineItem date={log.opened_at} label="Đã mở email" />}
                {log.clicked_at && <TimelineItem date={log.clicked_at} label="Đã click link" />}
                {log.unsubscribed_at && <TimelineItem date={log.unsubscribed_at} label="Đã unsubscribe" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-xs text-foreground">{value}</p>
    </div>
  );
}

function TimelineItem({ date, label, sub }: { date: string; label: string; sub?: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
      <div>
        <p className="text-foreground">{label}</p>
        {sub && <p className="text-muted-foreground">{sub}</p>}
        <p className="text-muted-foreground/60">{new Date(date).toLocaleString('vi-VN')}</p>
      </div>
    </div>
  );
}