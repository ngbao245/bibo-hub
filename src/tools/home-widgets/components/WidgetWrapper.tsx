// ============================================================
// Widget Wrapper — shared chrome for each widget
// ============================================================

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWidgetStore } from '../store';
import { saveWidgetConfig } from '../api';
import type { WidgetDefinition } from '../types';

interface Props {
  definition: WidgetDefinition;
  children: React.ReactNode;
}

export default function WidgetWrapper({ definition, children }: Props) {
  const { removeWidget, config } = useWidgetStore();

  function handleRemove() {
    removeWidget(definition.id);
    const updated = config.activeWidgets.filter((w) => w !== definition.id);
    saveWidgetConfig({ activeWidgets: updated });
  }

  const Icon = definition.icon;

  return (
    <div className="rounded border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{definition.label}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="p-3">
        {children}
      </div>
    </div>
  );
}