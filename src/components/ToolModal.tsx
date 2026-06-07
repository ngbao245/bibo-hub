import { type ReactNode } from 'react';
import { useModalStore, type ModalId } from '@/stores/modalStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';

// ============================================================
// ToolModal - cầu nối giữa shadcn Dialog và useModalStore
// ============================================================
//
// MỤC TIÊU: viết 1 modal mới chỉ cần làm:
//   <ToolModal id="calculator" title="Calculator">
//     <CalculatorContent />
//   </ToolModal>
//
// CÁCH HOẠT ĐỘNG:
// - shadcn Dialog cần `open: boolean` + `onOpenChange: (open) => void`
// - useModalStore lưu `current: ModalId | null` (modal nào đang mở)
// - Wrapper này:
//     · Đọc store: `current === id` → biết modal này có đang mở không
//     · Khi user đóng (ESC/click overlay/click ×): gọi `close()` của store
//
// Ưu điểm: file modal nội dung không cần biết về store, chỉ render UI.
// ============================================================

interface ToolModalProps {
  id: ModalId;
  title: string;
  description?: string;
  children: ReactNode;
  /** Tailwind className cho DialogContent (override max-width nếu cần) */
  className?: string;
}

export default function ToolModal({
  id,
  title,
  description,
  children,
  className,
}: ToolModalProps) {
  // Selector: chỉ subscribe field cần dùng để tránh re-render thừa
  const isOpen = useModalStore((s) => s.current === id);
  const close = useModalStore((s) => s.close);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Dialog gọi onOpenChange(false) khi user đóng (ESC/click outside/×)
        if (!open) close();
      }}
    >
      <DialogContent className={cn('max-w-md', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
