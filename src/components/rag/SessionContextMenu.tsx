// ============================================================
// SessionContextMenu — menu chuột phải cho session pill
// ============================================================
//
// Absolute positioned tại mouse coords, auto dismiss khi click outside
// hoặc Esc. Items conditional theo session.pinned (Pin ↔ Unpin).
//
// Fix race condition: dùng onMouseDown trực tiếp (không qua onClick)
// để action fire TRƯỚC khi document.mousedown listener dismiss menu.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, Pin, PinOff, X, XCircle, Trash2 } from 'lucide-react';

import type { RagSession } from '@/lib/rag/sessions';

const MENU_WIDTH = 180;
const MENU_HEIGHT_EST = 220;

interface Props {
  session: RagSession;
  x: number;
  y: number;
  onRename: () => void;
  onPinToggle: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onDismiss: () => void;
}

export default function SessionContextMenu({
  session,
  x,
  y,
  onRename,
  onPinToggle,
  onClose,
  onCloseOthers,
  onCloseAll,
  onDismiss,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss on click outside / Esc
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }
    // Delay để không dismiss ngay khi mở
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onDismiss]);

  // Position adjust
  const [pos, setPos] = useState<{ top: number; left: number }>(() => ({
    top: y,
    left: x,
  }));
  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + MENU_WIDTH > vw - 8) left = vw - MENU_WIDTH - 8;
    if (top + MENU_HEIGHT_EST > vh - 8) top = vh - MENU_HEIGHT_EST - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [x, y]);

  const style: React.CSSProperties = {
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    zIndex: 2147483647, // max int32 — chắc chắn trên mọi Radix portal
    pointerEvents: 'auto',
  };

  const btn =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-primary/10 hover:text-primary';

  // Handler wrapper: fire action + dismiss trong cùng frame.
  // Dùng onMouseDown thay onClick để chạy TRƯỚC document.mousedown dismiss listener.
  function makeHandler(action: () => void) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDismiss();
      // Defer action để menu unmount xong (tránh conflict với window.prompt/confirm)
      setTimeout(action, 0);
    };
  }

  return createPortal(
    <div
      ref={menuRef}
      data-rag-ctx-menu
      style={style}
      className="min-w-[180px] border border-border bg-popover shadow-lg"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" onMouseDown={makeHandler(onRename)} className={btn}>
        <Edit3 className="h-3.5 w-3.5" />
        Rename
      </button>
      <button type="button" onMouseDown={makeHandler(onPinToggle)} className={btn}>
        {session.pinned ? (
          <>
            <PinOff className="h-3.5 w-3.5" />
            Unpin
          </>
        ) : (
          <>
            <Pin className="h-3.5 w-3.5" />
            Pin
          </>
        )}
      </button>
      <div className="my-0.5 border-t border-border" />
      <button type="button" onMouseDown={makeHandler(onClose)} className={btn}>
        <X className="h-3.5 w-3.5" />
        Close
      </button>
      <button type="button" onMouseDown={makeHandler(onCloseOthers)} className={btn}>
        <XCircle className="h-3.5 w-3.5" />
        Close others
      </button>
      <button type="button" onMouseDown={makeHandler(onCloseAll)} className={btn}>
        <Trash2 className="h-3.5 w-3.5" />
        Close all
      </button>
    </div>,
    document.body,
  );
}