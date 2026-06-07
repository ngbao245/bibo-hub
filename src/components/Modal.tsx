import { useEffect, type ReactNode } from 'react';
import { useModalStore, type ModalId } from '@/stores/modalStore';

// ============================================================
// Modal - component dùng chung cho TẤT CẢ tool modals
// ============================================================
//
// THAY THẾ: 10+ file *-loader.js + *-modal.js cũ. Mỗi modal cũ ~150 dòng,
// giờ chỉ cần viết content bên trong <Modal>.
//
// CÁCH DÙNG:
//   <Modal id="calculator" title="🔢 Calculator">
//     <div>...nội dung...</div>
//   </Modal>
//
// Component tự lo:
//   - Hiển thị/ẩn dựa vào modalStore.current
//   - Đóng khi bấm Escape
//   - Đóng khi click overlay
//   - Lock scroll body khi mở
// ============================================================

interface ModalProps {
  id: ModalId;
  title: ReactNode;
  children: ReactNode;
  /** Width của modal-content. Default 600px */
  width?: string;
}

export default function Modal({ id, title, children, width = '600px' }: ModalProps) {
  const current = useModalStore((s) => s.current);
  const close = useModalStore((s) => s.close);
  const isOpen = current === id;

  // 📚 useEffect cho ESC key + lock body scroll
  // - deps = [isOpen, close] → effect chạy khi modal mở/đóng
  // - Khi mở: gắn listener ESC + lock scroll
  // - Cleanup: gỡ listener + restore scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    window.addEventListener('keydown', handleEsc);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70"
      onClick={close}
    >
      {/* stopPropagation để click vào content không trigger close */}
      <div
        className="flex max-h-[90vh] w-[90vw] flex-col border border-border bg-bg-elevated shadow-2xl"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-bg-secondary px-4 py-3">
          <div className="text-text-primary font-medium">{title}</div>
          <button
            onClick={close}
            className="text-text-muted hover:text-text-primary text-xl leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
