
import { create } from 'zustand';

// ============================================================
// Modal Store - quản lý modal nào đang mở (toàn app)
// ============================================================
//
// VÌ SAO DÙNG ZUSTAND THAY VÌ useState?
// - Hub có button mở modal (component Hub)
// - Modal nội dung ở component khác (Calculator, Translate...)
// - useGlobalShortcuts ở 1 chỗ khác nữa
// - Cả 3 cần cùng 1 state "modal nào đang mở"
// → useState phải lift lên App rồi prop drilling. Zustand thì component
//   nào cũng đọc/ghi trực tiếp, không qua trung gian.
//
// CÁCH DÙNG:
//   const open = useModalStore((s) => s.open);
//   open('calculator');
//
//   const current = useModalStore((s) => s.current);
//   if (current === 'calculator') { ... }
//
// LƯU Ý: chọn selector cụ thể (s) => s.open thay vì lấy cả state,
// để component chỉ re-render khi field đó thay đổi.
// ============================================================

// ID của tất cả modal trong app. Thêm modal mới → thêm vào đây.
// `as const` giúp TypeScript suy ra union type chính xác.
export const MODAL_IDS = [
  'calculator',
  'translate',
  'encoder',
  'backup',
  'shortcuts',
  'secret',
  'savings',
  'spxTracking',
  'dailyReminder',
  'cacheInspector',
  'crypto',
  'audio',
] as const;

export type ModalId = (typeof MODAL_IDS)[number];

interface ModalState {
  /** Modal đang mở, null nếu không có modal nào mở */
  current: ModalId | null;

  /** Mở modal */
  open: (id: ModalId) => void;

  /** Đóng modal hiện tại */
  close: () => void;

  /** Mở/đóng (toggle) — bấm shortcut lần 2 sẽ đóng */
  toggle: (id: ModalId) => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  current: null,
  open: (id) => set({ current: id }),
  close: () => set({ current: null }),
  toggle: (id) => set({ current: get().current === id ? null : id }),
}));