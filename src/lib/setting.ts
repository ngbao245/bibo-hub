
// ============================================================
// Setting — domain model
// ============================================================
//
// Resource trên mockapi (/Config) gồm:
//   id, name, description, group, type, config1..config10
// Tất cả field đều là string (theo schema mockapi).
//
// Ý nghĩa:
//   - group: nhóm cấp 1 (ví dụ "firebase", "api", "p2p"...)
//   - type:  nhóm cấp 2 trong group (ví dụ "production", "staging")
//   - configN: 10 slot tự do, mỗi slot có thể là FieldEntry JSON
//     (xem lib/fieldSlots.ts) hoặc plain string.
// ============================================================

export const CONFIG_KEYS = [
  'config1',
  'config2',
  'config3',
  'config4',
  'config5',
  'config6',
  'config7',
  'config8',
  'config9',
  'config10',
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

export interface Setting {
  id: string;
  name: string;
  description: string;
  group: string;
  type: string;
  config1: string;
  config2: string;
  config3: string;
  config4: string;
  config5: string;
  config6: string;
  config7: string;
  config8: string;
  config9: string;
  config10: string;
}

export type SettingInput = Omit<Setting, 'id'>;

export const EMPTY_SETTING: SettingInput = {
  name: '',
  description: '',
  group: '',
  type: '',
  config1: '',
  config2: '',
  config3: '',
  config4: '',
  config5: '',
  config6: '',
  config7: '',
  config8: '',
  config9: '',
  config10: '',
};

function s(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Parse 1 record raw từ mockapi → Setting (defensive) */
export function parseSetting(raw: unknown): Setting | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!r.id) return null;

  return {
    id: s(r.id),
    name: s(r.name),
    description: s(r.description),
    group: s(r.group),
    type: s(r.type),
    config1: s(r.config1),
    config2: s(r.config2),
    config3: s(r.config3),
    config4: s(r.config4),
    config5: s(r.config5),
    config6: s(r.config6),
    config7: s(r.config7),
    config8: s(r.config8),
    config9: s(r.config9),
    config10: s(r.config10),
  };
}

export function parseSettingList(raw: unknown): Setting[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseSetting).filter((c): c is Setting => c !== null);
}