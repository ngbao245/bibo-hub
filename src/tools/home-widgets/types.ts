// ============================================================
// Home Widgets — Types
// ============================================================

import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';

/** Definition of an available widget (registered in registry). */
export interface WidgetDefinition {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  component: ComponentType;
}

/** User's widget config (per-user, persisted). */
export interface UserWidgetConfig {
  /** Ordered list of active widget IDs. */
  activeWidgets: string[];
}

export const DEFAULT_WIDGET_CONFIG: UserWidgetConfig = {
  activeWidgets: ['focus', 'daily-reminder'],
};