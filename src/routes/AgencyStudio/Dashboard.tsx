// ============================================================
// Dashboard — Metrics + Recent activity feed
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/shared';
import { useNavigate } from 'react-router-dom';
import {
  Users, Megaphone, Mail, XCircle, MailOpen, MousePointerClick, MailX, Plus, MessageSquare,
} from 'lucide-react';

// ============================================================
// Data fetching
// ============================================================
function useDashboardMetrics() {
  return useQuery({
    queryKey: ['agency_dashboard'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [leadsRes, newLeadsRes, campaignsRes, sentTodayRes, failedRes, openedRes, clickedRes, repliedRes, unsubRes, sentSuccessMonthRes] =
        await Promise.all([
          authClient.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null),
          authClient.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', startOfMonth),
          authClient.from('campaigns').select('id', { count: 'exact', head: true }).in('status', ['Sending', 'Scheduled']),
          authClient.from('email_logs').select('id', { count: 'exact', head: true }).gte('sent_at', startOfDay),
          authClient.from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
          authClient.from('email_logs').select('id', { count: 'exact', head: true }).not('opened_at', 'is', null).gte('created_at', startOfMonth),
          authClient.from('email_logs').select('id', { count: 'exact', head: true }).not('clicked_at', 'is', null).gte('created_at', startOfMonth),
          authClient.from('email_logs').select('id', { count: 'exact', head: true }).not('replied_at', 'is', null).gte('created_at', startOfMonth),
          authClient.from('email_logs').select('id', { count: 'exact', head: true }).not('unsubscribed_at', 'is', null).gte('created_at', startOfMonth),
          // Denominator cho rate — chỉ email gửi thành công (không bao
          // gồm failed/bounced/complained) mới có thể opened/clicked/replied.
          authClient.from('email_logs').select('id', { count: 'exact', head: true }).in('status', ['sent', 'delivered']).gte('created_at', startOfMonth),
        ]);

      const sentSuccessMonth = sentSuccessMonthRes.count ?? 0;
      const opened = openedRes.count ?? 0;
      const clicked = clickedRes.count ?? 0;
      const replied = repliedRes.count ?? 0;

      return {
        totalLeads: leadsRes.count ?? 0,
        newLeadsMonth: newLeadsRes.count ?? 0,
        activeCampaigns: campaignsRes.count ?? 0,
        sentToday: sentTodayRes.count ?? 0,
        failed: failedRes.count ?? 0,
        openRate: sentSuccessMonth > 0 ? Math.round((opened / sentSuccessMonth) * 100) : 0,
        clickRate: sentSuccessMonth > 0 ? Math.round((clicked / sentSuccessMonth) * 100) : 0,
        replyRate: sentSuccessMonth > 0 ? Math.round((replied / sentSuccessMonth) * 100) : 0,
        unsubMonth: unsubRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

function useRecentActivity() {
  return useQuery({
    queryKey: ['agency_activity'],
    queryFn: async () => {
      const { data } = await authClient
        .from('email_logs')
        .select('id, recipient_name, recipient_email, subject, status, sent_at, opened_at, clicked_at, unsubscribed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ============================================================
// Components
// ============================================================
function MetricCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 border border-border p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const metrics = useDashboardMetrics();
  const activity = useRecentActivity();
  const isEmpty = !metrics.isLoading && metrics.data?.totalLeads === 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-sm font-semibold text-foreground">Dashboard</h1>

      {/* Metrics grid */}
      {metrics.isLoading ? (
        <LoadingState
          variant="skeleton"
          count={9}
          itemClassName="h-16 w-full"
          className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
          <MetricCard label="Total leads" value={metrics.data?.totalLeads ?? 0} icon={Users} />
          <MetricCard label="New this month" value={metrics.data?.newLeadsMonth ?? 0} icon={Users} />
          <MetricCard label="Active campaigns" value={metrics.data?.activeCampaigns ?? 0} icon={Megaphone} />
          <MetricCard label="Sent today" value={metrics.data?.sentToday ?? 0} icon={Mail} />
          <MetricCard label="Failed emails" value={metrics.data?.failed ?? 0} icon={XCircle} />
          <MetricCard label="Open rate (month)" value={`${metrics.data?.openRate ?? 0}%`} icon={MailOpen} />
          <MetricCard label="Click rate (month)" value={`${metrics.data?.clickRate ?? 0}%`} icon={MousePointerClick} />
          <MetricCard label="Reply rate (month)" value={`${metrics.data?.replyRate ?? 0}%`} icon={MessageSquare} />
          <MetricCard label="Unsubscribes (month)" value={metrics.data?.unsubMonth ?? 0} icon={MailX} />
        </div>
      )}

      {/* Empty CTA */}
      {isEmpty && (
        <EmptyState
          icon={Users}
          title="Bắt đầu bằng cách thêm lead đầu tiên"
          description="Thêm leads, tạo template, rồi gửi campaign đầu tiên."
          action={
            <Button onClick={() => navigate('/agency-studio/leads')} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Thêm lead
            </Button>
          }
        />
      )}

      {/* Recent activity */}
      {!isEmpty && (
        <div>
          <h2 className="mb-3 text-xs font-medium text-muted-foreground">Hoạt động gần đây</h2>
          {activity.isLoading && (
            <LoadingState variant="skeleton" count={5} layout="list" itemClassName="h-8 w-full" />
          )}
          {!activity.isLoading && (activity.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Chưa có hoạt động.</p>
          )}
          {(activity.data ?? []).map((log) => (
            <div key={log.id} className="flex items-center gap-2 border-b border-border py-2 text-xs">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-foreground">
                Email tới <strong>{log.recipient_name ?? log.recipient_email}</strong>: {log.subject}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {log.sent_at ? new Date(log.sent_at).toLocaleDateString('vi-VN') : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}