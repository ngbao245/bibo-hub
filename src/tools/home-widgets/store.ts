// ============================================================
// Home Widgets — Zustand Store
// ============================================================

import { create } from 'zustand';
import type { UserWidgetConfig } from './types';
import { DEFAULT_WIDGET_CONFIG } from './types';

interface WidgetState {
  config: UserWidgetConfig;
  loaded: boolean;

  setConfig: (config: UserWidgetConfig) => void;
  addWidget: (id: string) => void;
  removeWidget: (id: string) => void;
  reorderWidgets: (ids: string[]) => void;
}

export const useWidgetStore = create<WidgetState>((set) => ({
  config: DEFAULT_WIDGET_CONFIG,
  loaded: false,

  setConfig: (config) => set({ config, loaded: true }),

  addWidget: (id) =>
    set((state) => {
      if (state.config.activeWidgets.includes(id)) return state;
      return {
        config: { ...state.config, activeWidgets: [...state.config.activeWidgets, id] },
      };
    }),

  removeWidget: (id) =>
    set((state) => ({
      config: {
        ...state.config,
        activeWidgets: state.config.activeWidgets.filter((w) => w !== id),
      },
    })),

  reorderWidgets: (ids) =>
    set((state) => ({
      config: { ...state.config, activeWidgets: ids },
    })),
}));