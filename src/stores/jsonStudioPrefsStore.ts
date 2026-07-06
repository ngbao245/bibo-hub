import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CanvasThemeMode } from '@/lib/json-studio/types';

// ============================================================
// JSON Studio Preferences - persist localStorage
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
//
// MIGRATION v1: rename từ tool 'json-viewer' sang 'json-studio'. Nếu key mới chưa có
// nhưng key cũ (`bibo:json-viewer:prefs`) tồn tại → copy sang key mới, xoá key cũ.
// Set flag `bibo:json-studio:migrated-v1` để tránh chạy lại.
// ============================================================

const STORAGE_KEY = 'bibo:json-studio:prefs';
const LEGACY_STORAGE_KEY = 'bibo:json-viewer:prefs';
const MIGRATION_FLAG = 'bibo:json-studio:migrated-v1';

interface JsonStudioPrefsState {
  graphTheme: CanvasThemeMode;
  zoomOnScroll: boolean;
  showRuler: boolean;

  setGraphTheme: (theme: CanvasThemeMode) => void;
  setZoomOnScroll: (enabled: boolean) => void;
  setShowRuler: (show: boolean) => void;
}

type PersistedPrefs = Pick<
  JsonStudioPrefsState,
  'graphTheme' | 'zoomOnScroll' | 'showRuler'
>;

const DEFAULTS: PersistedPrefs = {
  graphTheme: 'dark',
  zoomOnScroll: true,
  showRuler: true,
};

/**
 * Migrate legacy key `bibo:json-viewer:prefs` → `bibo:json-studio:prefs` 1 lần.
 * Guard bằng flag. Chỉ chạy nếu key mới chưa tồn tại (không overwrite user data).
 */
function migrateLegacyPrefs(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const current = localStorage.getItem(STORAGE_KEY);
    if (legacy && !current) {
      localStorage.setItem(STORAGE_KEY, legacy);
    }
    if (legacy) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    localStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    // ignore — localStorage full / disabled → fallback default
  }
}

/** Đọc sync localStorage để lấy giá trị đúng ngay từ render đầu. */
function loadInitial(): PersistedPrefs {
  if (typeof localStorage === 'undefined') return DEFAULTS;
  migrateLegacyPrefs();
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

export const useJsonStudioPrefsStore = create<JsonStudioPrefsState>()(
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