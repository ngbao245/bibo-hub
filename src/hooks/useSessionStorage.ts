
import { useEffect, useState } from 'react';

// ============================================================
// useSessionStorage — state persist qua sessionStorage
// ============================================================
// Giống useLocalStorage nhưng mất khi đóng tab (session-scoped).

export function useSessionStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // sessionStorage có thể bị disable, bỏ qua
    }
  }, [key, value]);

  return [value, setValue];
}