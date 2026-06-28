// Bi-directional ratio-based scroll sync giữa 2 pane.
// Port + mở rộng từ markdown-live-preview/src/main.js `onDidScrollChange`.

import type { MutableRefObject } from 'react';

/**
 * Sync `dst` scroll position theo ratio của `src`.
 * `lock` ref chống infinite loop khi cả 2 pane đều listen scroll.
 */
export function syncScroll(
  src: HTMLElement,
  dst: HTMLElement,
  lock: MutableRefObject<boolean>,
) {
  if (lock.current) {
    lock.current = false;
    return;
  }
  const srcMax = src.scrollHeight - src.clientHeight;
  const dstMax = dst.scrollHeight - dst.clientHeight;
  if (srcMax <= 0 || dstMax <= 0) return;

  const ratio = src.scrollTop / srcMax;
  lock.current = true;
  dst.scrollTop = ratio * dstMax;
}