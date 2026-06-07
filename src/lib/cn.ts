import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ============================================================
// cn() helper - chuẩn shadcn/ui
// ============================================================
//
// Merge class names + xử lý conflict tailwind (vd: "p-2 p-4" → "p-4").
// Chuẩn của shadcn/ui, tất cả components dùng helper này.
//
// VÍ DỤ:
//   cn('px-2', condition && 'px-4', { 'bg-red': isError })
// ============================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
