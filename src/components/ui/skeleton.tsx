import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// ============================================================
// Skeleton — placeholder block phẳng
// ============================================================
// Chỉ là màu nền. Hiệu ứng sweep (ánh sáng chạy qua) đặt ở CONTAINER level
// trong LoadingState hoặc caller, để 1 beam duy nhất chạy qua nhiều block.
// KHÔNG đặt animation trên từng block — sẽ thành nhấp nháy per-block.
// ============================================================

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-muted', className)} {...props} />;
}