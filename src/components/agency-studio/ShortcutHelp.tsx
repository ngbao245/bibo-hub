// ============================================================
// ShortcutHelp — Dialog show cheat sheet keyboard shortcuts
// ============================================================

import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LEAD_SHORTCUTS } from '@/lib/agency-studio/shortcuts';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ShortcutHelp({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            <DialogTitle className="text-sm">Keyboard shortcuts</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Chỉ hoạt động khi không focus trong ô input/textarea.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col divide-y divide-border">
          {LEAD_SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">{s.description}</span>
              <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}