import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  /** Icon từ lucide-react. Default: `Inbox`. */
  icon?: LucideIcon;
  /** Tiêu đề chính, ngắn (1 dòng). */
  title: string;
  /** Mô tả phụ, có thể có gợi ý action. */
  description?: string;
  /** CTA (React node — thường là `<Button>`). */
  action?: React.ReactNode;
  /** Compact mode: padding nhỏ hơn cho sidebar/panel nhỏ. */
  compact?: boolean;
  className?: string;
}

/**
 * Empty state chuẩn cho hub. Dùng khi list rỗng, search không match, chưa có data.
 *
 * @example
 * // Search không kết quả
 * <EmptyState
 *   icon={Search}
 *   title={`Không có kết quả cho "${query}"`}
 *   description="Thử từ khoá khác hoặc xoá bộ lọc."
 * />
 *
 * @example
 * // Chưa có data lần đầu, kèm CTA
 * <EmptyState
 *   icon={FileText}
 *   title="Chưa có note nào"
 *   description="Tạo note đầu tiên để bắt đầu ghi chép."
 *   action={<Button onClick={handleNew}>Tạo note</Button>}
 * />
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-6' : 'gap-3 py-16',
        className,
      )}
    >
      <Icon
        className={cn(
          'text-muted-foreground',
          compact ? 'h-6 w-6' : 'h-10 w-10',
        )}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1">
        <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>
          {title}
        </p>
        {description && (
          <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}