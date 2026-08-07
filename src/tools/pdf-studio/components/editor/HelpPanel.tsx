// ============================================================
// PDF Studio Edit PDF — Help panel (shortcuts + usage guide)
// ============================================================

import { X } from 'lucide-react';

const SHORTCUTS = [
  { keys: 'Ctrl+Z', action: 'Undo' },
  { keys: 'Ctrl+Y', action: 'Redo' },
  { keys: 'Delete / Backspace', action: 'Xoa object dang chon' },
  { keys: 'Escape', action: 'Thoat mode hien tai / bo chon' },
  { keys: 'Ctrl+S', action: 'Luu draft ngay' },
  { keys: 'Ctrl++ / Ctrl+-', action: 'Zoom in / out' },
  { keys: 'Space + Drag', action: 'Pan khi khong nhap text' },
];

interface HelpPanelProps {
  onClose: () => void;
}

export function HelpPanel({ onClose }: HelpPanelProps) {
  return (
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Huong dan & Phim tat</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Dong Help"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Shortcuts */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Phim tat</h4>
          <table className="w-full text-xs">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys} className="border-b border-border/50 last:border-0">
                  <td className="py-1 pr-3 font-mono text-primary/80">{s.keys}</td>
                  <td className="py-1 text-foreground">{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Usage guide */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Cach dung</h4>
          <ul className="space-y-1.5 text-xs text-foreground">
            <li><span className="font-medium">Move:</span> Space + keo de pan, hoac chon tool Move.</li>
            <li><span className="font-medium">Zoom:</span> Ctrl + cuon chuot, hoac Ctrl+/Ctrl-.</li>
            <li><span className="font-medium">Thumbnail:</span> Click trang de nhay; dong/mo sidebar trai.</li>
            <li><span className="font-medium">Edit Text:</span> Bat tool, hover de thay vung, click chon, double click chinh sua.</li>
            <li><span className="font-medium">Export:</span> Nhan Export PDF o status bar de tai file moi.</li>
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Cong cu hien "Sap co" se duoc kich hoat trong cac ban cap nhat tiep theo.
          </p>
        </div>
      </div>
    </div>
  );
}
