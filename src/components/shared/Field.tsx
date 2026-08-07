import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  /** Label text hiển thị phía trên control. */
  label: string;
  /** id của control bên trong — dùng để liên kết `<label htmlFor>` + `aria-describedby`. */
  htmlFor: string;
  /** Helper text trung tính (không phải lỗi). Ẩn nếu có `error`. */
  helper?: string;
  /** Error message. Khi có, tự gắn `aria-invalid="true"` + `aria-describedby` vào control con. */
  error?: string;
  /** Đánh dấu required (hiện dấu * cạnh label). */
  required?: boolean;
  className?: string;
  /**
   * Control con — PHẢI là 1 element duy nhất (Input/Textarea/SelectField) nhận
   * `id`, `aria-invalid`, `aria-describedby` qua cloneElement.
   */
  children: ReactNode;
}

/**
 * Bọc label + control + helper/error text, tự lo accessibility wiring
 * (id, aria-describedby, aria-invalid) — tránh mỗi form tự viết tay và
 * quên liên kết đúng id (lỗi hay gặp: helper text tồn tại nhưng input
 * không có aria-describedby trỏ tới).
 *
 * @example
 * <Field label="Email" htmlFor="email" error={errors.email}>
 *   <Input id="email" type="email" value={value} onChange={onChange} />
 * </Field>
 *
 * @example
 * <Field label="Bio" htmlFor="bio" helper="Mô tả ngắn cho hồ sơ.">
 *   <Textarea id="bio" value={value} onChange={onChange} />
 * </Field>
 */
export function Field({ label, htmlFor, helper, error, required, className, children }: FieldProps) {
  const helperId = `${htmlFor}-helper`;
  const errorId = `${htmlFor}-error`;
  const describedBy = error ? errorId : helper ? helperId : undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: htmlFor,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {control}
      {error ? (
        <p id={errorId} className="flex items-center gap-1 text-xs text-destructive">
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="text-xs text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
