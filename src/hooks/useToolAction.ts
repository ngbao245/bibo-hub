import { useNavigate } from 'react-router-dom';
import { useModalStore } from '@/stores/modalStore';
import { toast } from '@/components/ui/sonner';
import type { Tool } from '@/lib/tools';

// ============================================================
// useToolAction - trả về hàm xử lý click cho 1 tool
// ============================================================
//
// Tool có 3 dạng action: modal / route / todo.
// Hook này chuyển đổi action → handler thực tế (open modal / navigate / alert).
// ============================================================

export function useToolAction() {
  const navigate = useNavigate();
  const openModal = useModalStore((s) => s.open);

  return (tool: Tool) => {
    const { action } = tool;
    switch (action.kind) {
      case 'modal':
        openModal(action.modalId);
        break;
      case 'route':
        navigate(action.path);
        break;
      case 'todo':
        toast.info(`${tool.label} - Coming soon!`);
        break;
    }
  };
}