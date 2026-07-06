// ============================================================
// SessionBar — thanh ngang các session pill, scroll horizontal
// ============================================================
//
// Render phía trên toolbar Auto/Internal/Sách. Ẩn nếu 0 sessions.
// Pin sessions sort lên đầu (đã sort ở sortSessions).
// Right-click pill → onContextMenu (caller mở SessionContextMenu).
// Nút X trong pill → onClose nhanh (thay cho nút xóa toàn bộ history cũ).
// Nút "+" cuối bên phải → onNewChat (tạo session mới).
// ============================================================

import { Pin, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { RagSession } from '@/lib/rag/sessions';

interface Props {
  sessions: RagSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (session: RagSession, evt: React.MouseEvent) => void;
  onNewChat: () => void;
  onClose: (session: RagSession) => void;
}

const TITLE_TRUNCATE = 20;
const PLACEHOLDER_TITLE = 'New session';

function truncateTitle(t: string): string {
  const s = (t || '').trim();
  if (!s) return PLACEHOLDER_TITLE;
  if (s.length <= TITLE_TRUNCATE) return s;
  return s.slice(0, TITLE_TRUNCATE) + '…';
}

export default function SessionBar({
  sessions,
  activeId,
  onSelect,
  onContextMenu,
  onNewChat,
  onClose,
}: Props) {
  if (sessions.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-popover/20 px-3 py-2">
      {sessions.map((s) => {
        const active = s.id === activeId;
        return (
          <div
            key={s.id}
            className={cn(
              'group flex shrink-0 items-center border px-2.5 py-1 text-xs transition-colors',
              'max-w-[200px] whitespace-nowrap',
              active
                ? 'border-primary bg-primary/15 font-medium text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu(s, e);
            }}
          >
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              title={s.title || PLACEHOLDER_TITLE}
              className="flex min-w-0 items-center gap-1"
            >
              {s.pinned && <Pin className="h-3 w-3 shrink-0" />}
              <span className="truncate">{truncateTitle(s.title)}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(s);
              }}
              title="Đóng session"
              aria-label="Đóng session"
              className={cn(
                'ml-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-colors',
                'opacity-0 group-hover:opacity-100',
                active && 'opacity-70',
                'hover:bg-destructive/20 hover:text-destructive',
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      {/* New chat button — cuối bên phải */}
      <button
        type="button"
        onClick={onNewChat}
        title="Tạo session chat mới"
        aria-label="Tạo session chat mới"
        className={cn(
          'ml-auto flex h-6 w-6 shrink-0 items-center justify-center border border-dashed border-border bg-background transition-colors',
          'text-muted-foreground hover:border-primary/50 hover:text-primary',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}