import { useLayoutEffect, useRef } from 'react';

// ============================================================
// useFlipAnimation - FLIP technique cho list reorder
// ============================================================
//
// FLIP = First, Last, Invert, Play.
//   1. Trước render mới: capture bounding rect (First).
//   2. Sau React render (useLayoutEffect): rect mới (Last).
//   3. Tính delta cũ→mới, set transform = -delta (Invert) — visually item ở vị trí cũ.
//   4. requestAnimationFrame: bỏ transform, thêm transition → animate về 0 (Play).
//
// Container ref + dataAttribute "data-flip-id" trên mỗi child là API.
// Re-run khi `key` thay đổi (vd: array length / order signature).
// ============================================================

export function useFlipAnimation(
  containerRef: React.RefObject<HTMLElement | null>,
  signature: string,
  duration = 250,
) {
  const prevPositions = useRef<Map<string, DOMRect>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[data-flip-id]'),
    );

    // Last: vị trí mới sau React render
    const newPositions = new Map<string, DOMRect>();
    for (const el of items) {
      const id = el.dataset.flipId;
      if (!id) continue;
      newPositions.set(id, el.getBoundingClientRect());
    }

    // Invert + Play
    for (const el of items) {
      const id = el.dataset.flipId;
      if (!id) continue;
      const prev = prevPositions.current.get(id);
      const next = newPositions.get(id);
      if (!prev || !next) continue;

      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (dx === 0 && dy === 0) continue;

      // Invert: đặt về vị trí cũ (không transition)
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = 'none';

      // Force reflow để browser apply ngay
      el.getBoundingClientRect();

      // Play: bỏ transform với transition → animate về 0
      requestAnimationFrame(() => {
        el.style.transform = '';
        el.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0, 0, 1)`;
      });

      // Cleanup transition sau khi xong (tránh ảnh hưởng lần sau)
      const cleanup = () => {
        el.style.transition = '';
        el.removeEventListener('transitionend', cleanup);
      };
      el.addEventListener('transitionend', cleanup);
    }

    // Save for next render
    prevPositions.current = newPositions;
  }, [signature, containerRef, duration]);
}
