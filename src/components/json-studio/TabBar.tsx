import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { TABS, type StudioTabId } from '@/lib/json-studio/tabs';
import { HelpDialog } from './HelpDialog';
import { cn } from '@/lib/cn';

// ============================================================
// TabBar — horizontal feature tabs cho JSON Studio shell
// ============================================================
//
// 7 tab feature + 1 nút Help ở cuối bên phải.
// Tab active: underline + text-foreground.
// Tab disabled: dim opacity + toast "coming soon" khi click.
// Responsive: overflow-x-auto + scroll-snap để mobile scroll ngang mượt.
// ============================================================

interface TabBarProps {
  activeTab: StudioTabId;
  onTabChange: (next: StudioTabId) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <div
        role="tablist"
        aria-label="JSON Studio features"
        className={cn(
          'flex w-full items-stretch gap-0 overflow-x-auto border-b border-border bg-card',
          '[scroll-snap-type:x_mandatory]'
        )}
      >
        {TABS.map(({ id, label, icon: Icon, disabled, hint }) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              aria-disabled={disabled}
              type="button"
              data-tab-id={id}
              onClick={() => {
                if (disabled) {
                  toast.info(`${label} — coming soon (${hint ?? 'Phase 2+'})`);
                  return;
                }
                onTabChange(id);
              }}
              className={cn(
                'group relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                '[scroll-snap-align:start]',
                active
                  ? 'text-foreground'
                  : disabled
                    ? 'cursor-not-allowed text-muted-foreground/50'
                    : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {active && (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 bg-primary"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}

        {/* Spacer đẩy Help nút về cuối bên phải */}
        <div className="ml-auto shrink-0" />

        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          title="Hướng dẫn từng tool"
          aria-label="Hướng dẫn"
          className={cn(
            'inline-flex shrink-0 items-center justify-center border-l border-border px-3 text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} activeTab={activeTab} />
    </>
  );
}