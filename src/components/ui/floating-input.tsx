import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

// FloatingInput — label bắt đầu như placeholder, trượt lên khi focus/fill.
// Border animate muted → primary. Self-managed focus state (không cần lift lên cha).
export interface FloatingInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  label: string;
  /** Icon leading (trái). */
  icon?: ReactNode;
  /** Node trailing (phải) — VD nút hiện/ẩn mật khẩu. */
  trailing?: ReactNode;
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ id, label, icon, trailing, className, value, onFocus, onBlur, onChange, ...props }, ref) => {
    const reactId = useId();
    const inputId = id ?? reactId;
    const [focused, setFocused] = useState(false);
    const isControlled = value != null;
    const [filled, setFilled] = useState(Boolean(props.defaultValue));
    const active = focused || (isControlled ? String(value).length > 0 : filled);

    return (
      <div className="relative">
        {icon && (
          <div
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-150',
              focused ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {icon}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          onChange={(e) => {
            if (!isControlled) setFilled(e.target.value.length > 0);
            onChange?.(e);
          }}
          placeholder=" "
          className={cn(
            'peer flex h-12 w-full border bg-background text-sm shadow-sm transition-colors duration-150 focus-visible:outline-none',
            icon ? 'pl-10' : 'pl-3',
            trailing ? 'pr-10' : 'pr-3',
            'pb-1 pt-4',
            focused ? 'border-primary ring-1 ring-primary/30' : 'border-input hover:border-muted-foreground/50',
            className,
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            'pointer-events-none absolute transition-all duration-150',
            icon ? 'left-10' : 'left-3',
            active
              ? 'top-1.5 text-[10px] font-medium text-primary'
              : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground',
          )}
        >
          {label}
        </label>
        {trailing && <div className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
    );
  },
);
FloatingInput.displayName = 'FloatingInput';
