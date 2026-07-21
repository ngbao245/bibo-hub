// ============================================================
// Add Widget Menu — dropdown to add widgets to home
// ============================================================

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useWidgetStore } from '../store';
import { saveWidgetConfig } from '../api';
import { WIDGET_REGISTRY } from '../registry';

export default function AddWidgetMenu() {
  const [open, setOpen] = useState(false);
  const { config, addWidget } = useWidgetStore();

  // Only show widgets not already active
  const available = WIDGET_REGISTRY.filter(
    (w) => !config.activeWidgets.includes(w.id),
  );

  function handleAdd(id: string) {
    addWidget(id);
    const updated = [...config.activeWidgets, id];
    saveWidgetConfig({ activeWidgets: updated });
    setOpen(false);
  }

  if (available.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        Add widget
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded border border-border bg-popover p-1 shadow-md">
            {available.map((w) => {
              const Icon = w.icon;
              return (
                <button
                  key={w.id}
                  onClick={() => handleAdd(w.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="text-left">
                    <div className="text-foreground">{w.label}</div>
                    <div className="text-[11px] text-muted-foreground">{w.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}