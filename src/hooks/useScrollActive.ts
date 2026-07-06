import { useEffect, useState } from 'react';

// ============================================================
// useScrollActive — return true khi user đang scroll window,
// false sau `delayMs` từ scroll event cuối.
// ============================================================
//
// Dùng để pause heavy animation (WebGL scene) trong lúc user
// scroll — giải phóng GPU bandwidth cho browser compositor.
//
// Passive listener + timer cleanup — không block scroll.
//
// Usage:
//   const scrolling = useScrollActive();          // default 150ms
//   const scrolling = useScrollActive(200);       // custom delay
//
// ============================================================

export function useScrollActive(delayMs = 150): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timerId: number | undefined;

    const onScroll = () => {
      setActive(true);
      if (timerId !== undefined) window.clearTimeout(timerId);
      timerId = window.setTimeout(() => setActive(false), delayMs);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [delayMs]);

  return active;
}