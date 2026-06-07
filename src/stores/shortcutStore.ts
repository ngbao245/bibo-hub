import { create } from 'zustand';

// ============================================================
// Shortcut Store - registry tập trung tất cả phím tắt
// ============================================================
//
// MỤC TIÊU: thay thế shortcut-config.js cũ bằng 1 store mà:
// - Mỗi component có thể đăng ký shortcut của mình (self-register)
// - Modal Shortcuts (Alt+K) đọc registry để hiển thị
// - useGlobalShortcuts đọc registry để bắt phím
//
// VÌ SAO TỰ ĐĂNG KÝ THAY VÌ HARDCODE TRONG 1 FILE?
// - Shortcut nằm cùng chỗ với feature → dễ maintain
// - Xoá feature thì shortcut cũng tự biến mất, không cần dọn config
// ============================================================

export interface Shortcut {
  /** Phím tắt dạng chuẩn hóa: 'alt+t', 'ctrl+s', 'escape' */
  key: string;

  /** Tên hiển thị trong modal Shortcuts */
  label: string;

  /** Hàm chạy khi bấm phím */
  handler: () => void;

  /** Nhóm hiển thị trong modal Shortcuts (Tools, Navigation...) */
  group?: string;
}

interface ShortcutState {
  shortcuts: Map<string, Shortcut>;

  /** Đăng ký shortcut. Trả về hàm hủy đăng ký (dùng trong useEffect cleanup) */
  register: (s: Shortcut) => () => void;

  /** Lấy danh sách shortcut (cho modal Shortcuts hiển thị) */
  getAll: () => Shortcut[];
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  shortcuts: new Map(),

  register: (s) => {
    // Tạo Map mới để Zustand detect thay đổi (Map mutate trực tiếp không trigger re-render)
    set((state) => {
      const next = new Map(state.shortcuts);
      next.set(s.key, s);
      return { shortcuts: next };
    });

    // Trả về hàm cleanup — useEffect sẽ gọi khi unmount
    return () => {
      set((state) => {
        const next = new Map(state.shortcuts);
        next.delete(s.key);
        return { shortcuts: next };
      });
    };
  },

  getAll: () => Array.from(get().shortcuts.values()),
}));
