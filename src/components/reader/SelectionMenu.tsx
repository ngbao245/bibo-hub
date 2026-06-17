import { Highlighter, Languages, StickyNote, X } from 'lucide-react';

interface Props {
  rect: { top: number; left: number; width: number; height: number };
  onHighlight: () => void;
  onNote: () => void;
  onTranslate: () => void;
  onDismiss: () => void;
}

export default function SelectionMenu({ rect, onHighlight, onNote, onTranslate, onDismiss }: Props) {
  const top = rect.top > 50 ? rect.top - 44 : rect.top + rect.height + 8;
  const left = Math.max(8, rect.left + rect.width / 2 - 90);

  return (
    <div
      className="fixed z-40 flex items-center gap-1 border border-zinc-700 bg-zinc-900 p-1 shadow-xl"
      style={{ top, left }}
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