// ============================================================
// PDF Studio Shared — Card hover actions (PSPDFKit-style floating bar)
// ============================================================
// Absolute positioned, opacity 0 → 1 on parent group-hover.
// Parent card must have class `group/item`.
// ============================================================

import { Search, Copy, RotateCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CardHoverActionsProps {
  onPreview?: () => void;
  onDuplicate?: () => void;
  onRotate?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function CardHoverActions({
  onPreview,
  onDuplicate,
  onRotate,
  onDelete,
  className,
}: CardHoverActionsProps) {
  return (
    <div
      className={cn(
        'absolute -top-3 left-1/2 z-20 flex -translate-x-1/2 gap-1 overflow-hidden rounded-lg opacity-0 transition-opacity group-hover/item:opacity-100',
        className,
      )}
    >
      {onPreview && (
        <ActionButton onClick={onPreview} title="Xem truoc" variant="default">
          <Search className="h-4 w-4" />
        </ActionButton>
      )}
      {onDuplicate && (
        <ActionButton onClick={onDuplicate} title="Nhan doi" variant="default">
          <Copy className="h-4 w-4" />
        </ActionButton>
      )}
      {onRotate && (
        <ActionButton onClick={onRotate} title="Xoay 90°" variant="default">
          <RotateCw className="h-4 w-4" />
        </ActionButton>
      )}
      {onDelete && (
        <ActionButton onClick={onDelete} title="Xoa" variant="destructive">
          <Trash2 className="h-4 w-4" />
        </ActionButton>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  title,
  variant,
  children,
}: {
  onClick: () => void;
  title: string;
  variant: 'default' | 'destructive';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md border shadow-md transition-colors',
        variant === 'destructive'
          ? 'border-destructive/30 bg-destructive text-destructive-foreground hover:bg-destructive/90'
          : 'border-border bg-background text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
