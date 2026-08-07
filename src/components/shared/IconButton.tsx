import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon từ lucide-react. */
  icon: LucideIcon;
  /** Bắt buộc — trở thành `aria-label`. Icon-only button không có text visible
   * nên đây là accessible name duy nhất cho screen reader. */
  label: string;
  /** Tone màu. `destructive` dùng cho action xóa/nguy hiểm. Default: `default`. */
  tone?: 'default' | 'destructive';
  /** Variant style. Default: `ghost`. */
  variant?: 'ghost' | 'outline';
  /** Size icon trong button (class `h-X w-X`). Default: `h-3.5 w-3.5`. */
  iconClassName?: string;
}

/**
 * Icon-only button chuẩn cho hub. Luôn có `aria-label` — không dùng `title`
 * làm accessible name duy nhất (title không đọc được reliably bởi screen reader,
 * và không hiện trên mobile/touch).
 *
 * @example
 * <IconButton icon={Trash2} label="Xóa file" tone="destructive" onClick={remove} />
 *
 * @example
 * // Password toggle — PHẢI giữ trong tab order, không set tabIndex={-1}
 * <IconButton
 *   icon={showPw ? EyeOff : Eye}
 *   label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
 *   aria-pressed={showPw}
 *   onClick={() => setShowPw(!showPw)}
 * />
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, tone = 'default', variant = 'ghost', iconClassName, className, type = 'button', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        type={type}
        variant={variant}
        size="icon"
        aria-label={label}
        title={label}
        className={cn(
          'h-8 w-8',
          tone === 'destructive' && 'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
          className,
        )}
        {...props}
      >
        <Icon className={cn('h-3.5 w-3.5', iconClassName)} aria-hidden="true" />
      </Button>
    );
  },
);
IconButton.displayName = 'IconButton';
