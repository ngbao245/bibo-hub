// ============================================================
// PDF Studio - Workspace header (sticky top, PSPDFKit-inspired)
// ============================================================
// Header = toolbar. 1 row sticky chứa:
//   [back][icon][title/subtitle] | [toolbarActions tùy tool] | [CTA]
// Toolbar actions dùng ToolbarButton (icon+label vertical stack)
// từ WorkspaceToolbar.tsx, insert vào slot toolbarActions.
// ============================================================

import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export interface WorkspaceHeaderAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'destructive';
}

interface WorkspaceHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onBack: () => void;
  primaryAction?: WorkspaceHeaderAction;
  /** Secondary action rendered bên trái primary (outline style). */
  secondaryAction?: WorkspaceHeaderAction;
  /** Slot cho toolbar action buttons (ToolbarButton, ToolbarSeparator, ...) */
  toolbarActions?: React.ReactNode;
  className?: string;
}

export function WorkspaceHeader({
  icon: Icon,
  title,
  subtitle,
  onBack,
  primaryAction,
  secondaryAction,
  toolbarActions,
  className,
}: WorkspaceHeaderProps) {
  return (
    <div
      className={cn(
        // Negative margin phá padding p-6 của <main> → header full-width edge-to-edge
        // Không sticky — header scroll cùng content (chỉ EditPdf full-editor mới sticky)
        // py-2 vừa cho toolbar button (icon+label vertical ~44px + padding = ~60px header)
        '-mx-6 -mt-6 mb-4 flex items-center gap-3 border-b border-border bg-card px-4 py-2',
        className,
      )}
    >
      {/* Left cluster: back + icon + title/subtitle stacked */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onBack}
          aria-label="Quay lại"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />

        <div className="flex min-w-0 flex-col gap-0 leading-tight">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && (
            <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Middle: toolbar actions (scrollable trên narrow screen) */}
      {toolbarActions && (
        <>
          <div className="h-9 w-px shrink-0 bg-border" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
            {toolbarActions}
          </div>
        </>
      )}

      {/* Right: divider + secondary + primary CTA */}
      {(primaryAction || secondaryAction) && (
        <>
          {!toolbarActions && <div className="flex-1" aria-hidden="true" />}
          <div className="h-9 w-px shrink-0 bg-border" aria-hidden="true" />
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled || secondaryAction.loading}
              className="h-9 shrink-0 gap-2 px-3"
            >
              {secondaryAction.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <secondaryAction.icon className="h-4 w-4" aria-hidden="true" />
              )}
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button
              variant={primaryAction.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || primaryAction.loading}
              className="h-9 shrink-0 gap-2 px-4"
            >
              {primaryAction.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <primaryAction.icon className="h-4 w-4" aria-hidden="true" />
              )}
              {primaryAction.label}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
