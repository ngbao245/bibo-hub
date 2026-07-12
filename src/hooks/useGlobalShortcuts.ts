
import { useEffect } from 'react';
import { useShortcutStore } from '@/stores/shortcutStore';

// ============================================================
// useGlobalShortcuts - bắt phím tắt toàn app
// ============================================================
//
// Gọi 1 lần ở App.tsx. Hook đọc registry từ shortcutStore và
// gắn 1 listener `keydown` lên window.
//
// 📚 GIẢI THÍCH useEffect (cho người chưa vững):
//
// useEffect(callback, [deps])
//   - callback: chạy SAU khi component render xong
//   - deps: mảng giá trị. Nếu giá trị nào thay đổi → chạy lại callback
//   - return từ callback: cleanup, chạy TRƯỚC khi callback chạy lại
//                         hoặc khi component unmount
//
// Ở đây:
//   - deps = [shortcuts] → mỗi khi có shortcut mới đăng ký, hook gắn lại listener
//   - cleanup: removeEventListener để tránh leak (gắn nhiều listener trùng)
// ============================================================

/** Chuẩn hóa KeyboardEvent thành string 'alt+t', 'ctrl+shift+s'... */
function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  if (e.metaKey) parts.push('meta');

  // Lấy key chính (bỏ qua nếu chỉ bấm modifier)
  const key = (e.key ?? '').toLowerCase();
  if (!key || ['control', 'alt', 'shift', 'meta'].includes(key)) {
    return parts.join('+');
  }
  parts.push(key);
  return parts.join('+');
}

export function useGlobalShortcuts() {
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const capturing = useShortcutStore((s) => s.capturing);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // User đang capture phím tắt trong Setting → skip
      if (capturing) return;

      // Bỏ qua nếu user đang gõ trong input/textarea (trừ Escape)
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      const key = normalizeKey(e);
      if (isTyping && key !== 'escape') return;

      const shortcut = shortcuts.get(key);
      if (shortcut) {
        e.preventDefault();
        shortcut.handler();
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [shortcuts, capturing]);
}