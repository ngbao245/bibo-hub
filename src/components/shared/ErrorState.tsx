import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface ErrorStateProps {
  /** Message hiển thị. Default: "Có lỗi xảy ra". */
  message?: string;
  /** Handler bấm "Thử lại". Nếu không truyền, ẩn nút. */
  onRetry?: () => void;
  /** Text của retry button. Default: "Thử lại". */
  retryLabel?: string;
  /** Compact mode: layout nhỏ hơn cho inline error. */
  compact?: boolean;
  className?: string;
}

/**
 * Error state chuẩn cho hub. Dùng khi query fail, mutation fail, parse fail.
 *
 * @example
 * // Query fail full page
 * if (isError) return <ErrorState message={error.message} onRetry={refetch} />;
 *
 * @example
 * // Inline error trong card
 * <ErrorState compact message="Không load được data" onRetry={refetch} />
 */
export function ErrorState({
  message = 'Có lỗi xảy ra',
  onRetry,
  retryLabel = 'Thử lại',
  compact,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 border border-destructive/40 bg-destructive/10 text-destructive',
        compact ? 'p-2 text-xs' : 'p-4 text-sm',
        className,
      )}
    >
      <AlertCircle
        className={cn('shrink-0', compact ? 'h-4 w-4' : 'h-5 w-5')}
        aria-hidden="true"
      />
      <div className="flex flex-1 flex-col gap-2">
        <p className="break-words">{message}</p>
        {onRetry && (
          <Button
            variant="outline"
            size={compact ? 'sm' : 'default'}
            onClick={onRetry}
            className="self-start"
          >
            <RotateCw className={cn('mr-1.5', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}