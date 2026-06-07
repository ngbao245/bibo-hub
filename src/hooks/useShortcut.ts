import { useEffect } from 'react';
import { useShortcutStore, type Shortcut } from '@/stores/shortcutStore';

// ============================================================
// useShortcut - đăng ký 1 phím tắt từ component bất kỳ
// ============================================================
//
// VÌ SAO TÁCH RA: thay vì hardcode toàn bộ shortcut trong 1 file config,
// mỗi component tự đăng ký shortcut của mình. Component unmount → shortcut
// tự gỡ. Dễ maintain hơn nhiều.
//
// CÁCH DÙNG:
//   useShortcut({
//     key: 'alt+c',
//     label: 'Calculator',
//     group: 'Tools',
//     handler: () => open('calculator'),
//   });
//
// 📚 GIẢI THÍCH useEffect Ở ĐÂY:
//
// register() từ store trả về 1 hàm "unregister" — đó chính là cleanup function.
// Pattern subscribe/unsubscribe chuẩn của React.
//
// deps = [...] gồm tất cả field của shortcut. Nếu handler đổi (closure mới mỗi
// render), useEffect chạy lại để đăng ký lại với handler mới nhất.
//
// ⚠️ GOTCHA QUAN TRỌNG: nếu truyền object inline `useShortcut({...})` thì object
// này tạo mới mỗi render → handler reference đổi → effect chạy lại liên tục.
// Component cha NÊN dùng useCallback cho handler hoặc define ngoài component.
// Nhưng vì cleanup chạy đúng (unregister cũ trước register mới), không có bug,
// chỉ tốn vài chu kỳ thôi. Với app này, không đáng lo.
// ============================================================

export function useShortcut(shortcut: Shortcut) {
  const register = useShortcutStore((s) => s.register);

  useEffect(() => {
    // register trả về unregister → React tự gọi unregister khi cleanup
    return register(shortcut);
  }, [register, shortcut.key, shortcut.label, shortcut.group, shortcut.handler]);
}
