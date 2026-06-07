import { useEffect } from 'react';

// ============================================================
// useDebouncedEffect - chạy effect sau khi deps "ngừng đổi" trong N ms
// ============================================================
//
// 📚 GIẢI THÍCH:
// useEffect bình thường chạy ngay khi deps đổi.
// Nhưng đôi khi muốn delay (vd: auto-save: chỉ save khi user dừng gõ 1s).
//
// CÁCH HOẠT ĐỘNG:
// - useEffect chạy mỗi khi deps đổi
// - Bên trong: setTimeout sau delay ms → chạy effect thật
// - Cleanup: clearTimeout của lần render trước
// → User gõ liên tục → mỗi lần gõ huỷ timer cũ, đặt timer mới
// → Chỉ khi user dừng gõ đủ delay ms, effect mới thực sự chạy
//
// CÁCH DÙNG:
//   useDebouncedEffect(() => {
//     saveNote();
//   }, [title, content], 800);
//
// ⚠️ deps phải pass đúng giống useEffect, không thì stale closure.
// ============================================================

export function useDebouncedEffect(
  effect: () => void,
  deps: React.DependencyList,
  delay: number,
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = setTimeout(effect, delay);
    return () => clearTimeout(timer);
  }, [...deps, delay]);
}
