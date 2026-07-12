// ============================================================
// InlineEditCell — Double-click cell → edit inline
// ============================================================
// Text mode (default) → double-click → input/select mode
//  - Enter/blur: save
//  - Escape: cancel + revert
// Loading spinner overlay khi mutation pending.
// ============================================================

import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type CommonProps = {
  className?: string;
  disabled?: boolean;
  pending?: boolean;
};

type TextCellProps = CommonProps & {
  kind: 'text';
  value: string;
  placeholder?: string;
  onSave: (value: string) => void | Promise<void>;
};

type SelectCellProps<T extends string> = CommonProps & {
  kind: 'select';
  value: T;
  options: readonly T[];
  renderDisplay?: (v: T) => React.ReactNode;
  onSave: (value: T) => void | Promise<void>;
};

type Props<T extends string = string> = TextCellProps | SelectCellProps<T>;

export function InlineEditCell<T extends string = string>(props: Props<T>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(props.value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(props.value);
  }, [props.value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) inputRef.current.select();
    }
  }, [editing]);

  async function commit() {
    if (draft === props.value) {
      setEditing(false);
      return;
    }
    try {
      if (props.kind === 'text') {
        await props.onSave(draft);
      } else {
        await (props.onSave as (v: T) => void | Promise<void>)(draft as T);
      }
    } finally {
      setEditing(false);
    }
  }

  function cancel() {
    setDraft(props.value);
    setEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); void commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onDoubleClick={() => { if (!props.disabled) setEditing(true); }}
        onClick={(e) => e.stopPropagation()}
        disabled={props.disabled}
        className={cn(
          'relative w-full text-left cursor-text rounded px-1 -mx-1 py-0.5 -my-0.5 hover:bg-muted/50 transition-colors',
          props.disabled && 'cursor-not-allowed opacity-70',
          props.className,
        )}
        title="Double-click để chỉnh sửa"
      >
        {props.kind === 'select' && props.renderDisplay
          ? props.renderDisplay(props.value as T)
          : props.value || <span className="text-muted-foreground italic">—</span>}
        {props.pending && (
          <Loader2 className="absolute right-0.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </button>
    );
  }

  if (props.kind === 'select') {
    return (
      <select
        ref={(el) => { inputRef.current = el; }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full border border-primary bg-background px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary',
          props.className,
        )}
      >
        {props.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={(el) => { inputRef.current = el; }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      placeholder={props.placeholder}
      className={cn(
        'w-full border border-primary bg-background px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary',
        props.className,
      )}
    />
  );
}