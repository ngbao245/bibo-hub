
import { create } from 'zustand';

// ============================================================
// Shortcut Store — registry tập trung
// ============================================================
//
// Flow:
//   1. App boot → bootstrap hook gọi `setRegistry(entries)` với tất
//      cả tool/control có thể gán shortcut. Mỗi entry có default key
//      '' (rỗng) — không bắt phím nếu không có override.
//   2. Bootstrap hook gọi `setOverrides({ id: { key, enabled } })`
//      → store apply override: update `byId` + `shortcuts` (chỉ entry
//      có enabled=true && key !== '' mới vào `shortcuts`).
//   3. useGlobalShortcuts subscribe `shortcuts` → bind keydown.
// ============================================================

export interface Shortcut {
  /** ID ổn định (vd 'tool.calculator') */
  id: string;
  /** Phím tắt — '' nghĩa là chưa gán */
  key: string;
  /** Tên hiển thị */
  label: string;
  /** Hàm chạy khi bấm phím */
  handler: () => void;
  /** Nhóm hiển thị */
  group?: string;
}

export interface ShortcutOverride {
  key: string;
  enabled: boolean;
}

interface ShortcutState {
  /** Map theo effective key (chỉ chứa enabled + có key) */
  shortcuts: Map<string, Shortcut>;
  /** Tất cả entries (kể cả disabled hoặc chưa gán key) — cho UI list */
  byId: Map<string, Shortcut>;
  /** Override loaded từ API */
  overrides: Record<string, ShortcutOverride>;
  /** True khi user đang capture phím tắt → useGlobalShortcuts skip */
  capturing: boolean;

  /** Set registry (gọi 1 lần app boot) */
  setRegistry: (entries: Shortcut[]) => void;
  /** Set overrides + apply */
  setOverrides: (o: Record<string, ShortcutOverride>) => void;
  /** Set capturing flag (dùng bởi UI capture button) */
  setCapturing: (c: boolean) => void;
}

// Browser-reserved keys không cho phép user gán shortcut.
// Nếu user lỡ gán → vẫn được lưu vào overrides nhưng không bind keydown.
const RESERVED_KEYS = new Set([
  'ctrl+f', 'ctrl+r', 'ctrl+t', 'ctrl+w', 'ctrl+n',
  'ctrl+shift+t', 'ctrl+shift+w', 'ctrl+shift+n',
  'ctrl+l', // address bar
  'f5', 'f11', 'f12',
]);

/** Rebuild shortcuts (key→entry) Map từ byId + overrides */
function rebuildShortcuts(
  byId: Map<string, Shortcut>,
  overrides: Record<string, ShortcutOverride>,
): Map<string, Shortcut> {
  const next = new Map<string, Shortcut>();
  for (const [id, s] of byId) {
    const ov = overrides[id];
    const enabled = ov?.enabled ?? true;
    const effectiveKey = ov?.key ?? s.key;
    if (!enabled || !effectiveKey) continue;
    if (RESERVED_KEYS.has(effectiveKey)) continue; // skip reserved
    next.set(effectiveKey, { ...s, key: effectiveKey });
  }
  return next;
}

export const useShortcutStore = create<ShortcutState>((set) => ({
  shortcuts: new Map(),
  byId: new Map(),
  overrides: {},
  capturing: false,

  setRegistry: (entries) => {
    set((state) => {
      const byId = new Map<string, Shortcut>();
      for (const e of entries) byId.set(e.id, e);
      const shortcuts = rebuildShortcuts(byId, state.overrides);
      return { byId, shortcuts };
    });
  },

  setOverrides: (overrides) => {
    set((state) => ({
      overrides,
      shortcuts: rebuildShortcuts(state.byId, overrides),
    }));
  },

  setCapturing: (capturing) => set({ capturing }),
}));