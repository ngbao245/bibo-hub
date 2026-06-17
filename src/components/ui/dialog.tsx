import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

// shadcn Dialog wrapper quanh Radix Dialog.
// Đẹp, animation mượt, accessibility chuẩn.

/**
 * Cắt string tại word boundary cuối cùng trước `max` ký tự, append "…".
 * Tránh hiện text bị cắt giữa chữ kiểu "mớiNot…". Nếu trong khoảng 40% cuối
 * không có space (1 chuỗi liền dài bất thường), fallback cắt thẳng.
 */
function clampAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + '…';
}

function clampNode(children: ReactNode, max: number): ReactNode {
  return typeof children === 'string' ? clampAtWord(children, max) : children;
}

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Overlay nhẹ + blur để không nuốt UI nền — modern style
      'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { showClose?: boolean }
>(({ className, children, showClose = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Glass surface: card semi-transparent + backdrop-blur, ring thay border
        // để tách lớp tinh tế trên dark theme. Bo nhẹ rounded-lg, shadow sâu
        // tạo cảm giác "nổi" 1mm trên overlay.
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4',
        'rounded-lg bg-card/80 p-6 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-xl',
        'duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:bg-white/5 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      // Combo: JS clampNode cắt tại word boundary (tránh "mớiNot…"),
      // CSS truncate làm safety net cho JSX children hoặc string vẫn quá
      // dài so với layout (1 dòng, ellipsis ở mép phải).
      'truncate text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  >
    {clampNode(children, 80)}
  </DialogPrimitive.Title>
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      // Combo: clampNode cắt theo word, line-clamp-3 fallback CSS giới hạn
      // chiều cao (3 dòng) phòng caller truyền JSX hoặc string vẫn vượt.
      'line-clamp-3 text-sm text-muted-foreground',
      className,
    )}
    {...props}
  >
    {clampNode(children, 240)}
  </DialogPrimitive.Description>
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;