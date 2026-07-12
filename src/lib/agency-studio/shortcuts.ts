// ============================================================
// useLeadListShortcuts — keyboard nav trong Leads page
// ============================================================
// Shortcuts:
//   j/↓         next lead (highlight)
//   k/↑         prev lead
//   Enter       open lead detail
//   n           open new lead form
//   /           focus search
//   ?           show cheat sheet
//   Escape      close dialog / clear highlight
//
// Rule: ignore khi focus trong input/textarea/select/contenteditable
// (tránh conflict với typing).
// ============================================================

import { useEffect, useRef } from 'react';

interface UseLeadListShortcutsOptions {
  itemCount: number;
  activeIndex: number;
  setActiveIndex: (idx: number | ((prev: number) => number)) => void;
  onOpenItem: (idx: number) => void;
  onNewItem: () => void;
  onFocusSearch: () => void;
  onShowHelp: () => void;
  onEscape?: () => void;
  /** Disable khi dialog đang mở (VD ImportDialog, LeadForm). */
  disabled?: boolean;
}

function isTypingElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useLeadListShortcuts({
  itemCount,
  activeIndex,
  setActiveIndex,
  onOpenItem,
  onNewItem,
  onFocusSearch,
  onShowHelp,
  onEscape,
  disabled = false,
}: UseLeadListShortcutsOptions) {
  const stateRef = useRef({ itemCount, activeIndex });
  stateRef.current = { itemCount, activeIndex };

  useEffect(() => {
    if (disabled) return;

    function onKeyDown(e: KeyboardEvent) {
      // Skip modifier combos (Ctrl+K, Cmd+K...) để không conflict.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const active = document.activeElement;
      const typing = isTypingElement(active);

      // `Escape` luôn active kể cả trong input — dùng để clear.
      if (e.key === 'Escape') {
        if (typing) (active as HTMLElement).blur();
        onEscape?.();
        return;
      }

      // Còn lại: skip nếu đang typing.
      if (typing) return;

      const { itemCount: n } = stateRef.current;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          if (n === 0) return;
          e.preventDefault();
          setActiveIndex((prev) => Math.min(n - 1, Math.max(0, prev) + 1));
          break;
        case 'k':
        case 'ArrowUp':
          if (n === 0) return;
          e.preventDefault();
          setActiveIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'Enter': {
          const idx = stateRef.current.activeIndex;
          if (idx >= 0 && idx < n) {
            e.preventDefault();
            onOpenItem(idx);
          }
          break;
        }
        case 'n':
          e.preventDefault();
          onNewItem();
          break;
        case '/':
          e.preventDefault();
          onFocusSearch();
          break;
        case '?':
          e.preventDefault();
          onShowHelp();
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, setActiveIndex, onOpenItem, onNewItem, onFocusSearch, onShowHelp, onEscape]);
}

export const LEAD_SHORTCUTS: { key: string; description: string }[] = [
  { key: 'j / ↓', description: 'Lead tiếp theo' },
  { key: 'k / ↑', description: 'Lead trước' },
  { key: 'Enter', description: 'Mở lead đang chọn' },
  { key: 'n', description: 'Thêm lead mới' },
  { key: '/', description: 'Focus ô tìm kiếm' },
  { key: '?', description: 'Hiện danh sách shortcut' },
  { key: 'Escape', description: 'Đóng dialog / bỏ focus' },
];