import { useEffect, useRef, useState } from 'react';
import { Settings2, Check } from 'lucide-react';
import { useJsonStudioPrefsStore } from '@/tools/json-studio/prefs-store';
import styles from './GraphToolbar.module.css';
import { cn } from '@/lib/cn';

// ============================================================
// PreferencesMenu - popover settings cho graph view
// Toggle: light/dark theme, zoom on scroll, show ruler.
// State persist qua useJsonStudioPrefsStore.
// ============================================================

interface ToggleRowProps {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ label, hint, value, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left text-xs hover:bg-muted"
    >
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center border border-border',
          value ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'
        )}
      >
        {value && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

export function PreferencesMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const graphTheme = useJsonStudioPrefsStore((s) => s.graphTheme);
  const zoomOnScroll = useJsonStudioPrefsStore((s) => s.zoomOnScroll);
  const showRuler = useJsonStudioPrefsStore((s) => s.showRuler);
  const setGraphTheme = useJsonStudioPrefsStore((s) => s.setGraphTheme);
  const setZoomOnScroll = useJsonStudioPrefsStore((s) => s.setZoomOnScroll);
  const setShowRuler = useJsonStudioPrefsStore((s) => s.setShowRuler);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={cn(styles.iconBtn, open && styles.active)}
        onClick={() => setOpen((v) => !v)}
        title="Preferences"
        aria-label="preferences"
      >
        <Settings2 className="h-[22px] w-[22px]" />
      </button>

      {open && (
        <div
          className={cn(
            // Bottom-center toolbar nên popup hướng lên trên
            'absolute bottom-full right-0 z-50 mb-2 min-w-[220px] border border-border bg-popover p-1 shadow-md',
            'text-sm text-popover-foreground'
          )}
        >
          <ToggleRow
            label="Light mode"
            hint="Đổi theme canvas sang sáng"
            value={graphTheme === 'light'}
            onChange={(next) => setGraphTheme(next ? 'light' : 'dark')}
          />
          <ToggleRow
            label="Zoom on scroll"
            hint="Tắt → wheel sẽ pan dọc"
            value={zoomOnScroll}
            onChange={setZoomOnScroll}
          />
          <ToggleRow
            label="Ruler / Grid"
            hint="Hiện lưới background"
            value={showRuler}
            onChange={setShowRuler}
          />
        </div>
      )}
    </div>
  );
}