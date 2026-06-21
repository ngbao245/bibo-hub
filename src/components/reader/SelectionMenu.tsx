import { useRef, useEffect, useState } from 'react';
import { Highlighter, Languages, StickyNote, X } from 'lucide-react';

interface Props {
  rect: { top: number; left: number; width: number; height: number };
  onHighlight: () => void;
  onNote: () => void;
  onTranslate: () => void;
  onDismiss: () => void;
}

const MARGIN = 8;
const MENU_HEIGHT = 44;
const MENU_WIDTH_EST = 220; // estimated, updated after mount

export default function SelectionMenu({ rect, onHighlight, onNote, onTranslate, onDismiss }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>(() =>
    calcPos(rect, MENU_WIDTH_EST, MENU_HEIGHT),
  );

  // After mount we know the real width → recalculate
  useEffect(() => {
    if (!menuRef.current) return;
    const { offsetWidth, offsetHeight } = menuRef.current;
    setPos(calcPos(rect, offsetWidth, offsetHeight));
  }, [rect]);

  return (
    <div
      ref={menuRef}
      className="fixed z-40 flex items-center gap-1 border border-zinc-700 bg-zinc-900 p-1 shadow-xl"
      style={{ top: pos.top, left: pos.left }}
    >
      <MenuButton onClick={onHighlight} icon={<Highlighter className="h-3.5 w-3.5" />} label="Highlight" />
      <MenuButton onClick={onNote} icon={<StickyNote className="h-3.5 w-3.5" />} label="Note" />
      <MenuButton onClick={onTranslate} icon={<Languages className="h-3.5 w-3.5" />} label="Translate" />
      <button
        onClick={onDismiss}
        className="ml-1 border-l border-zinc-800 px-1.5 py-1 text-zinc-500 hover:text-zinc-200"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function calcPos(
  rect: { top: number; left: number; width: number; height: number },
  menuW: number,
  menuH: number,
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Vertical: prefer above selection, flip below if not enough room
  const spaceAbove = rect.top - menuH - MARGIN;
  const top =
    spaceAbove >= 0
      ? rect.top - menuH - MARGIN
      : rect.top + rect.height + MARGIN;

  // Clamp top so menu never goes below viewport
  const clampedTop = Math.min(Math.max(MARGIN, top), vh - menuH - MARGIN);

  // Horizontal: center on selection, then clamp within viewport
  const idealLeft = rect.left + rect.width / 2 - menuW / 2;
  const clampedLeft = Math.min(Math.max(MARGIN, idealLeft), vw - menuW - MARGIN);

  return { top: clampedTop, left: clampedLeft };
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
    >
      {icon}
      {label}
    </button>
  );
}