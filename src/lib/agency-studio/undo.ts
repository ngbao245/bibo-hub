// ============================================================
// useUndoableDelete — soft delete + undo trong window 5s
// ============================================================
// Pattern:
//  1. Gọi `deleteItems(ids)` → soft-delete ngay (mutation.mutateAsync).
//  2. Show toast "Đã xoá {N}. [Hoàn tác]" với action button.
//  3. User click Hoàn tác trong 5s → call restore mutation.
//  4. Sau 5s không click → toast dismiss, DB đã có deleted_at (cleanup
//     sau 24h qua manual/cronjob).
//
// Không hardcode logic soft-delete ở đây — nhận `onDelete`/`onRestore`
// từ caller (usually TanStack Query mutation) để tách concern.
// ============================================================

import { toast } from 'sonner';

interface UndoableDeleteOptions {
  /** Perform actual delete. Should return ids đã xoá. */
  onDelete: (ids: string[]) => Promise<string[]>;
  /** Restore mutation — nhận ids đã xoá, revert deleted_at. */
  onRestore: (ids: string[]) => Promise<void>;
  /** Custom messages. */
  labels?: {
    /** Fn nhận N → text hiển thị. Default: `Đã xoá {N} mục` */
    success?: (count: number) => string;
    /** Text button undo. Default: `Hoàn tác` */
    action?: string;
    /** Toast khi restore success. Default: `Đã hoàn tác` */
    restored?: string;
    /** Toast khi delete fail. Default error.message. */
  };
  /** Milliseconds window. Default 5000. */
  windowMs?: number;
}

export interface UndoableDeleteApi {
  deleteWithUndo: (ids: string[]) => Promise<void>;
}

export function createUndoableDelete({
  onDelete,
  onRestore,
  labels,
  windowMs = 5000,
}: UndoableDeleteOptions): UndoableDeleteApi {
  const successFn = labels?.success ?? ((n: number) => `Đã xoá ${n} mục`);
  const actionLabel = labels?.action ?? 'Hoàn tác';
  const restoredLabel = labels?.restored ?? 'Đã hoàn tác';

  return {
    async deleteWithUndo(ids) {
      if (ids.length === 0) return;
      let deletedIds: string[];
      try {
        deletedIds = await onDelete(ids);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Xoá thất bại');
        return;
      }

      // Toast với action button — sonner tự dismiss sau duration.
      // Không cần setTimeout riêng, action button chỉ callable trong
      // khi toast còn hiện.
      toast.success(successFn(deletedIds.length), {
        duration: windowMs,
        action: {
          label: actionLabel,
          onClick: async () => {
            try {
              await onRestore(deletedIds);
              toast.success(restoredLabel);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Hoàn tác thất bại');
            }
          },
        },
      });
    },
  };
}