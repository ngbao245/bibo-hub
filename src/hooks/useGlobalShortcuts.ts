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
  const key = e.key.toLowerCase();
  if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
    parts.push(key);
  }
  return parts.join('+');
}

export function useGlobalShortcuts() {
  // Lấy Map shortcuts từ store. Khi store đổi (có shortcut mới đăng ký),
  // component gọi hook này sẽ re-render → useEffect chạy lại với danh sách mới.
  const shortcuts = useShortcutStore((s) => s.shortcuts);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

    // CLEANUP: gỡ listener khi shortcuts đổi hoặc component unmount.
    // Thiếu cleanup → mỗi lần re-render gắn thêm 1 listener → memory leak + xử lý phím nhiều lần.
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [shortcuts]);
}
