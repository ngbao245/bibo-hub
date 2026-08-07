// ============================================================
// PDF Studio — Shared workspace toolbar (PSPDFKit-inspired)
// ============================================================
// Toolbar horizontal ở đầu workspace với icon + label vertical stack.
// Compose từ ToolbarButton + ToolbarSeparator.
// ============================================================

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function WorkspaceToolbar({ children, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-stretch gap-1 rounded-lg border border-border bg-card px-2 py-1.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  destructive?: boolean;
  className?: string;
  title?: string;
}

export function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  active = false,
  destructive = false,
  className,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={cn(
        'flex min-w-[64px] flex-col items-center gap-0.5 rounded px-2 py-1 text-[10px] font-medium transition-colors',
        disabled
          ? 'cursor-not-allowed text-muted-foreground/50'
          : active
            ? 'bg-primary/15 text-primary'
            : destructive
              ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

export function ToolbarSeparator() {
  return <div className="mx-1 my-1 w-px bg-border" aria-hidden="true" />;
}

/** Spacer để đẩy các button sau về phía phải */
export function ToolbarSpacer() {
  return <div className="flex-1" aria-hidden="true" />;
}
