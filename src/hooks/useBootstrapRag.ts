// ============================================================
// useBootstrapRag — gọi tryBootstrapRag() 1 lần ở App mount
// ============================================================
//
// Idempotent: re-mount sẽ chạy lại nhưng store đã có sẵn nên rẻ.
// Lỗi setup không throw — chỉ set status='needs_setup' trong store,
// UI tự handle CTA "Add Gemini key in Settings".
// ============================================================

import { useEffect } from 'react';
import { tryBootstrapRag } from '@/lib/rag/auto-bootstrap';
import { runLazyFixupNotes } from '@/lib/rag/backfill';

/** Delay lazy fixup tầng 1 sau boot để không cản render lần đầu. */
const LAZY_FIXUP_DELAY_MS = 5000;

export function useBootstrapRag(): void {
  useEffect(() => {
    let cancelled = false;
    let fixupTimer: number | null = null;

    (async () => {
      try {
        const result = await tryBootstrapRag();
        if (cancelled) return;

        if (result.status === 'ready') {
          // eslint-disable-next-line no-console
          console.info('[rag] ready');

          // Lazy fixup tầng 1: background scan toàn bộ notes + GC orphan.
          //   - Delay 5s để không đánh vào latency boot.
          //   - gc=true: xóa row Supabase không còn entity trong MockAPI
          //     (vd user xóa note từ MockAPI dashboard hoặc delete queue drop).
          fixupTimer = window.setTimeout(() => {
            if (cancelled) return;
            void runLazyFixupNotes({ verbose: true, gc: true }).catch((err) => {
              // eslint-disable-next-line no-console
              console.warn('[rag] lazy fixup tầng 1 fail:', err);
            });
          }, LAZY_FIXUP_DELAY_MS);
        } else if (result.status === 'needs_setup') {
          // eslint-disable-next-line no-console
          console.warn('[rag] ⚠ needs setup:', result.errorMessage);
        } else {
          // eslint-disable-next-line no-console
          console.error('[rag] ❌ bootstrap error:', result.errorMessage);
        }
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[rag] unexpected bootstrap error', err);
      }
    })();

    return () => {
      cancelled = true;
      if (fixupTimer !== null) window.clearTimeout(fixupTimer);
    };
  }, []);
}