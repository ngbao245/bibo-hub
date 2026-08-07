// ============================================================
// PDF Studio Shared — Page stepper (Split after every N pages)
// ============================================================
// Inline control: checkbox + label + [-] N [+] + "pages"
// ============================================================

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PageStepperProps {
  /** Whether the stepper is active (checkbox checked) */
  enabled: boolean;
  /** Toggle enabled */
  onToggle: (enabled: boolean) => void;
  /** Current N value */
  value: number;
  /** Change N */
  onChange: (value: number) => void;
  /** Min value (default 1) */
  min?: number;
  /** Max value */
  max?: number;
  /** Label before stepper */
  label?: string;
  /** Suffix after number */
  suffix?: string;
  className?: string;
}

export function PageStepper({
  enabled,
  onToggle,
  value,
  onChange,
  min = 1,
  max = 999,
  label = 'Tach sau moi',
  suffix = 'trang',
  className,
}: PageStepperProps) {
  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={enabled}
        onClick={() => onToggle(!enabled)}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
          enabled
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background',
        )}
      >
        {enabled && (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="2,6 5,9 10,3" />
          </svg>
        )}
      </button>

      <span className="text-xs text-foreground whitespace-nowrap">{label}</span>

      {/* Stepper */}
      <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
        <button
          type="button"
          onClick={decrement}
          disabled={!enabled || value <= min}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-background text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-30 disabled:bg-transparent"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-6 text-center text-xs font-medium text-foreground">{value}</span>
        <button
          type="button"
          onClick={increment}
          disabled={!enabled || value >= max}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-background text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-30 disabled:bg-transparent"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <span className="text-xs text-foreground whitespace-nowrap">{suffix}</span>
    </div>
  );
}
