// ============================================================
// Optimistic UI helper
// ============================================================
//
// Mục tiêu: UI update ngay, API save background, rollback nếu fail.
//
// Pattern TanStack Query optimistic update:
//   onMutate:  cache cũ → snapshot, update cache ngay
//   onError:   rollback cache về snapshot
//   onSettled: refetch để đảm bảo sync
//
// Kèm: beforeunload warning khi có pending mutations.
// ============================================================

// ============================================================
// Pending mutations counter — dùng cho beforeunload warning
// ============================================================

let pendingCount = 0;

export function incrementPending() {
  pendingCount++;
  if (pendingCount === 1) {
    window.addEventListener('beforeunload', warnBeforeUnload);
  }
}

export function decrementPending() {
  pendingCount = Math.max(0, pendingCount - 1);
  if (pendingCount === 0) {
    window.removeEventListener('beforeunload', warnBeforeUnload);
  }
}

function warnBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = 'Đang lưu dữ liệu. Bạn có chắc muốn rời trang?';
  return e.returnValue;
}

// ============================================================
// Generic optimistic helpers cho TanStack Query
// ============================================================

import type { QueryClient } from '@tanstack/react-query';

/**
 * Tạo optimistic config cho useMutation.
 *
 * Sử dụng:
 *   useMutation({
 *     mutationFn: ...,
 *     ...optimisticList(queryClient, ['tasks'], (old, newItem) => [...old, newItem]),
 *   })
 *
 * @param qc - QueryClient
 * @param queryKey - Cache key cần update optimistic
 * @param updater - Hàm nhận (oldData, mutationInput) → newData
 */
export function optimisticList<TData, TInput>(
  qc: QueryClient,
  queryKey: readonly unknown[],
  updater: (old: TData, input: TInput) => TData,
) {
  return {
    onMutate: async (input: TInput) => {
      incrementPending();

      // Cancel refetch đang chạy (tránh ghi đè optimistic data)
      await qc.cancelQueries({ queryKey });

      // Snapshot cache hiện tại
      const snapshot = qc.getQueryData<TData>(queryKey);

      // Update cache ngay với data mới (optimistic)
      if (snapshot !== undefined) {
        qc.setQueryData<TData>(queryKey, updater(snapshot, input));
      }

      return { snapshot };
    },

    onError: (_err: unknown, _input: TInput, context: { snapshot?: TData } | undefined) => {
      // Rollback về snapshot nếu API fail
      if (context?.snapshot !== undefined) {
        qc.setQueryData(queryKey, context.snapshot);
      }
    },

    onSettled: () => {
      decrementPending();
      // Refetch để sync với server (đảm bảo data đúng)
      qc.invalidateQueries({ queryKey });
    },
  };
}
