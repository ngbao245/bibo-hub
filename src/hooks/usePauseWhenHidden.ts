import { useEffect, useState, type RefObject } from 'react';

// ============================================================
// usePauseWhenHidden — return `paused = true` khi:
//   1. Tab hidden (document.visibilityState === 'hidden'), HOẶC
//   2. Element ref rời viewport (IntersectionObserver)
// ============================================================
//
// Dùng cho animation heavy (canvas WebGL, three.js) — pause khi
// user không nhìn thấy để tiết kiệm GPU + battery.
//
// Options:
//   threshold  — % visible để coi là in-view. Default 0.1.
//                Tăng lên (VD 0.3) để pause SỚM khi user bắt đầu
//                scroll khỏi element — giảm jank scroll.
//   rootMargin — CSS margin string, dùng khi cần offset viewport.
//                Default '0px'.
//
// Usage:
//   const ref = useRef<HTMLDivElement>(null);
//   const paused = usePauseWhenHidden(ref);                        // default threshold 0.1
//   const paused = usePauseWhenHidden(ref, { threshold: 0.3 });    // pause sớm
//
// ============================================================

interface UsePauseWhenHiddenOptions {
  threshold?: number;
  rootMargin?: string;
}

export function usePauseWhenHidden(
  ref: RefObject<HTMLElement | null>,
  options: UsePauseWhenHiddenOptions = {},
): boolean {
  const { threshold = 0.1, rootMargin = '0px' } = options;

  const [tabHidden, setTabHidden] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false,
  );
  const [outOfView, setOutOfView] = useState(false);

  // Page Visibility API
  useEffect(() => {
    const handler = () => setTabHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // IntersectionObserver
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setOutOfView(!entry.isIntersecting);
      },
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin]);

  return tabHidden || outOfView;
}