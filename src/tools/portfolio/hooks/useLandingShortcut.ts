import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ============================================================
// useLandingShortcut — Alt+P navigate `/portfolio`.
// ============================================================
//
// Hardcoded shortcut ngoài shortcutStore vì:
// - Escape hatch cho owner mở public landing từ Hub
// - Không xuất hiện trong Shortcut Manager của Setting (ẩn)
// - Không collide với user override tool shortcut (khác key space)
// ============================================================

export function useLandingShortcut() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key.toLowerCase() !== 'p') return;

      // Skip nếu user đang gõ trong input/textarea
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isTyping) return;

      e.preventDefault();
      navigate('/portfolio');
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}