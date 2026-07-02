import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import type { LogEntry } from '@/lib/packer/types';

// ============================================================
// TerminalLog - hiển thị log scrollable kiểu terminal
// ============================================================
//
// Auto-scroll xuống dòng cuối khi có log mới.
// Giữ tối đa N dòng để tránh DOM phình to.
// ============================================================

interface TerminalLogProps {
  logs: LogEntry[];
  maxLines?: number;
}

const TYPE_COLORS: Record<LogEntry['type'], string> = {
  info: 'text-muted-foreground',
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
};

export default function TerminalLog({ logs, maxLines = 100 }: TerminalLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 📚 Auto-scroll xuống cuối khi logs thay đổi.
  // deps = [logs] để chạy mỗi khi log mới được thêm.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  if (logs.length === 0) return null;

  // Chỉ hiển thị N dòng cuối
  const visible = logs.slice(-maxLines);

  return (
    <div
      ref={containerRef}
      className="max-h-48 overflow-y-auto border border-border bg-background p-2 font-mono text-xs"
    >
      {visible.map((log) => (
        <div key={log.id} className={cn('whitespace-pre-wrap', TYPE_COLORS[log.type])}>
          <span className="text-muted-foreground">
            [{log.timestamp.toLocaleTimeString('vi-VN', { hour12: false })}]
          </span>{' '}
          {log.message}
        </div>
      ))}
    </div>
  );
}