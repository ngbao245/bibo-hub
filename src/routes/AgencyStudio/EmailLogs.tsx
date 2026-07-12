// ============================================================
// EmailLogs page
// ============================================================

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/cn';

import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import TrackingTimeline from '@/components/agency-studio/TrackingTimeline';
import { useEmailLogsQuery, type EmailLog } from '@/api/agency-studio/emailLogs';
import { useCampaignsQuery } from '@/api/agency-studio/campaigns';

const STATUS_COLOR: Record<string, string> = {
  queued: 'text-muted-foreground',
  sent: 'text-primary',
  delivered: 'text-success',
  failed: 'text-destructive',
  bounced: 'text-destructive',
  complained: 'text-warning',
};

export default function EmailLogs() {
  const [campaignFilter, setCampaignFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  const logsQuery = useEmailLogsQuery({ campaignId: campaignFilter || undefined, status: statusFilter || undefined });
  const campaignsQuery = useCampaignsQuery();

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className="flex flex-1 flex-col border-r border-border">
        {/* Header + filters */}
        <div className="border-b border-border px-4 py-3">
          <h1 className="mb-2 text-sm font-semibold text-foreground">Email Logs</h1>
          <div className="flex gap-2">
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="border border-border bg-background px-2 py-1 text-xs focus:outline-none"
            >
              <option value="">Tất cả campaign</option>
              {(campaignsQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-border bg-background px-2 py-1 text-xs focus:outline-none"
            >
              <option value="">Tất cả status</option>
              {['queued', 'sent', 'delivered', 'failed', 'bounced', 'complained'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {logsQuery.isLoading && (
            <div className="p-4">
              <LoadingState variant="skeleton" count={6} layout="list" itemClassName="h-10 w-full" />
            </div>
          )}
          {logsQuery.isError && (
            <div className="p-4">
              <ErrorState message="Load failed" onRetry={() => logsQuery.refetch()} />
            </div>
          )}
          {!logsQuery.isLoading && !logsQuery.isError && (
            (logsQuery.data?.logs ?? []).length === 0 ? (
              <div className="p-4">
                <EmptyState icon={Mail} title="Chưa có email nào" description="Gửi campaign đầu tiên để thấy logs tại đây." />
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2">Recipient</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Opened</th>
                    <th className="px-3 py-2">Clicked</th>
                    <th className="px-3 py-2">Replied</th>
                    <th className="px-3 py-2">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {(logsQuery.data?.logs ?? []).map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={cn('cursor-pointer border-b border-border hover:bg-muted/30', selectedLog?.id === log.id && 'bg-primary/5')}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">{log.recipient_name ?? log.recipient_email}</p>
                        <p className="text-muted-foreground">{log.recipient_email}</p>
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate text-muted-foreground">{log.subject}</td>
                      <td className={`px-3 py-2 font-medium ${STATUS_COLOR[log.status] ?? 'text-foreground'}`}>{log.status}</td>
                      <td className="px-3 py-2">{log.opened_at ? <span className="text-success">Yes</span> : '—'}</td>
                      <td className="px-3 py-2">{log.clicked_at ? <span className="text-success">Yes</span> : '—'}</td>
                      <td className="px-3 py-2">{log.replied_at ? <span className="text-primary">Yes</span> : '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {log.sent_at ? new Date(log.sent_at).toLocaleDateString('vi-VN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {selectedLog && (
        <div className="w-80 shrink-0 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-foreground">{selectedLog.subject}</p>
            <p className="text-xs text-muted-foreground">{selectedLog.recipient_email}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Tracking</p>
            <TrackingTimeline log={selectedLog} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Nội dung email</p>
            <pre className="whitespace-pre-wrap text-xs text-foreground bg-muted/20 p-2 border border-border max-h-80 overflow-y-auto font-sans">
              {selectedLog.body_snapshot}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}