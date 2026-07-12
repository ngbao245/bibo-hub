// ============================================================
// TrackingTimeline — Email event timeline
// ============================================================

import type { EmailLog } from '@/api/agency-studio/emailLogs';

interface TimelineEvent {
  date: string;
  label: string;
  color?: string;
}

function getEvents(log: EmailLog): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (log.sent_at) events.push({ date: log.sent_at, label: 'Đã gửi', color: 'text-primary' });
  if (log.status === 'delivered') events.push({ date: log.sent_at ?? log.created_at, label: 'Delivered', color: 'text-success' });
  if (log.opened_at) events.push({ date: log.opened_at, label: 'Đã mở', color: 'text-success' });
  if (log.clicked_at) events.push({ date: log.clicked_at, label: 'Đã click link', color: 'text-success' });
  if (log.replied_at) events.push({ date: log.replied_at, label: 'Đã reply', color: 'text-primary' });
  if (log.unsubscribed_at) events.push({ date: log.unsubscribed_at, label: 'Unsubscribed', color: 'text-destructive' });
  if (log.status === 'failed' || log.status === 'bounced') {
    events.push({ date: log.created_at, label: `${log.status === 'bounced' ? 'Bounced' : 'Failed'}${log.error_message ? `: ${log.error_message}` : ''}`, color: 'text-destructive' });
  }
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

interface Props {
  log: EmailLog;
}

export default function TrackingTimeline({ log }: Props) {
  const events = getEvents(log);
  return (
    <div className="space-y-2 text-xs">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3">
          <div className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current ${e.color ?? 'text-muted-foreground'}`} />
          <div>
            <p className={e.color ?? 'text-muted-foreground'}>{e.label}</p>
            <p className="text-muted-foreground/60">{new Date(e.date).toLocaleString('vi-VN')}</p>
          </div>
        </div>
      ))}
      {events.length === 0 && <p className="text-muted-foreground">Chưa có sự kiện nào.</p>}
    </div>
  );
}