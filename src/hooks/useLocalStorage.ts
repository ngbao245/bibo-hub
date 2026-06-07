import { useEffect, useState } from 'react';

// ============================================================
// useLocalStorage - state đồng bộ localStorage
// ============================================================
//
// 📚 GIẢI THÍCH useEffect Ở ĐÂY:
//
// useEffect(() => {...}, [key, value])
// → Mỗi khi `value` đổi, ghi vào localStorage.
// → Mỗi khi `key` đổi (hiếm), cũng ghi.
//
// useState(() => initialFn)
// → "Lazy initializer": hàm chỉ chạy 1 lần ở mount, đọc localStorage
//   tránh chạy mỗi render.
//
// Cleanup không cần vì localStorage.setItem không có resource cần dọn.
// ============================================================

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage có thể bị disable (private mode), bỏ qua
    }
  }, [key, value]);

  return [value, setValue];
}
