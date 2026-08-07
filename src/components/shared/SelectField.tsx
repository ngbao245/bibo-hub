import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

/**
 * Native `<select>` styled theo cùng token với `Input` (border, focus ring,
 * shadow). Dùng native select thay Radix Select vì catalog chỉ cần dropdown
 * đơn giản — native select đã có keyboard + screen reader support built-in
 * miễn phí, không cần thêm dependency.
 *
 * @example
 * <Field label="Category" htmlFor="category">
 *   <SelectField id="category" defaultValue="">
 *     <option value="" disabled>Select...</option>
 *     <option value="a">Category A</option>
 *   </SelectField>
 * </Field>
 */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'flex h-9 w-full appearance-none border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    );
  },
);
SelectField.displayName = 'SelectField';
