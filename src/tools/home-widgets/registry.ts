// ============================================================
// Home Widgets — Registry
// ============================================================
// All available widgets registered here. Add new widgets by
// adding an entry to WIDGET_REGISTRY.
// ============================================================

import { Sun, Focus } from 'lucide-react';
import type { WidgetDefinition } from './types';
import DailyReminderWidget from './widgets/DailyReminderWidget';
import FocusWidget from './widgets/FocusWidget';

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'focus',
    label: 'Tap trung hom nay',
    description: 'Cong viec can focus + ghi chu gan day + quick add',
    icon: Focus,
    component: FocusWidget,
  },
  {
    id: 'daily-reminder',
    label: 'Daily Reminder',
    description: 'Recurring tasks chua hoan thanh hom nay',
    icon: Sun,
    component: DailyReminderWidget,
  },
];

export function getWidgetById(id: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}