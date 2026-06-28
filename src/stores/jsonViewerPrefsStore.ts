import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CanvasThemeMode } from '@/lib/json-viewer/types';

// ============================================================
// JSON Viewer Preferences - persist localStorage
// ============================================================
//
// Tách store riêng vì:
// - Prefs cần persist (user mở lại tool vẫn giữ setting)
// - Main data store thì không (rawData không persist - quá lớn, dễ thay đổi)
// - Subscribe riêng → component nào chỉ quan tâm prefs không re-render khi data đổi
//
// Để tránh "flash from default" khi reload (ruler hiện → mất → hiện lại):
// đọc localStorage SYNC ngay khi module load, dùng làm default state.
// Như vậy render đầu tiên đã có giá trị đúng, không bị Zustand rehydrate async sau.
// ============================================================

const STORAGE_KEY = 'bibo:json-viewer:prefs';

interface JsonViewerPrefsState {
  graphTheme: CanvasThemeMode;
  zoomOnScroll: boolean;
  showRuler: boolean;

  setGraphTheme: (theme: CanvasThemeMode) => void;
  setZoomOnScroll: (enabled: boolean) => void;
  setShowRuler: (show: boolean) => void;
}

type PersistedPrefs = Pick<
  JsonViewerPrefsState,
  'graphTheme' | 'zoomOnScroll' | 'showRuler'
>;

const DEFAULTS: PersistedPrefs = {
  graphTheme: 'dark',
  zoomOnScroll: true,
  showRuler: true,
};

/** Đọc sync localStorage để lấy giá trị đúng ngay từ render đầu. */
function loadInitial(): PersistedPrefs {
  if (typeof localStorage === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    // Zustand v4 persist format: { state: {...}, version: ... }
    const state = parsed?.state ?? parsed;
    return {
      graphTheme: state?.graphTheme ?? DEFAULTS.graphTheme,
      zoomOnScroll: state?.zoomOnScroll ?? DEFAULTS.zoomOnScroll,
      showRuler: state?.showRuler ?? DEFAULTS.showRuler,
    };
  } catch {
    return DEFAULTS;
  }
}

const initial = loadInitial();

export const useJsonViewerPrefsStore = create<JsonViewerPrefsState>()(
  persist(
    (set) => ({
      // Khởi tạo từ localStorage sync — render đầu đã đúng
      ...initial,

      setGraphTheme: (graphTheme) => set({ graphTheme }),
      setZoomOnScroll: (zoomOnScroll) => set({ zoomOnScroll }),
      setShowRuler: (showRuler) => set({ showRuler }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // BỎ auto-rehydrate vì đã load sync ở `loadInitial()`.
      // Persist vẫn auto-save khi setState (nhờ subscribe), nhưng không trigger
      // rehydrate async sau mount → không bao giờ flash từ default → persisted value.
      skipHydration: true,
    }
  )
);