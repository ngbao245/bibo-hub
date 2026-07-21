// ============================================================
// Widget Area — renders active widgets on home page
// ============================================================

import { useWidgetStore } from '../store';
import { useLoadWidgetConfig } from '../api';
import { getWidgetById } from '../registry';
import WidgetWrapper from './WidgetWrapper';
import AddWidgetMenu from './AddWidgetMenu';

export default function WidgetArea() {
  useLoadWidgetConfig();

  const { config, loaded } = useWidgetStore();

  if (!loaded) return null;
  if (config.activeWidgets.length === 0) {
    return (
      <div className="mb-4 flex items-center justify-end">
        <AddWidgetMenu />
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Widgets
        </span>
        <AddWidgetMenu />
      </div>

      {config.activeWidgets.map((id) => {
        const def = getWidgetById(id);
        if (!def) return null;
        return (
          <WidgetWrapper key={id} definition={def}>
            <def.component />
          </WidgetWrapper>
        );
      })}
    </div>
  );
}