import {
  Network,
  FileJson,
  GitCompare,
  ArrowRightLeft,
  Search,
  ShieldCheck,
  Code,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// JSON Studio — Tab config
// ============================================================
//
// 7 tab feature. Phase 1 chỉ enable `visualize`. Các tab còn lại
// `disabled: true` — Phase 2+ sẽ implement lần lượt.
//
// `id` sync với URL query `?tab={id}` — thay đổi id là breaking cho
// bookmark cũ, cân nhắc kỹ.
// ============================================================

export type StudioTabId =
  | 'visualize'
  | 'format'
  | 'diff'
  | 'convert'
  | 'path'
  | 'schema'
  | 'ts';

export interface StudioTab {
  id: StudioTabId;
  label: string;
  icon: LucideIcon;
  disabled: boolean;
  /** Ngắn gọn cho toast "coming soon" */
  hint?: string;
}

export const TABS: readonly StudioTab[] = [
  { id: 'visualize', label: 'Visualize', icon: Network, disabled: false },
  { id: 'format', label: 'Format', icon: FileJson, disabled: false, hint: 'Prettify / Minify / Sort keys / JSONL' },
  { id: 'diff', label: 'Diff', icon: GitCompare, disabled: false, hint: 'Structural JSON compare' },
  { id: 'convert', label: 'Convert', icon: ArrowRightLeft, disabled: false, hint: 'YAML / XML / CSV / JSONL' },
  { id: 'path', label: 'Path', icon: Search, disabled: false, hint: 'JSONPath tester' },
  { id: 'schema', label: 'Schema', icon: ShieldCheck, disabled: false, hint: 'JSON Schema Validator' },
  { id: 'ts', label: 'TS Bridge', icon: Code, disabled: false, hint: 'JSON ↔ TypeScript ↔ Schema' },
] as const;

/** Validate raw string từ URL, fallback `visualize` nếu invalid. */
export function normalizeTab(raw: string | null | undefined): StudioTabId {
  if (!raw) return 'visualize';
  const found = TABS.find((t) => t.id === raw);
  return found ? found.id : 'visualize';
}

/** Tra tab theo id (đảm bảo tồn tại vì đã normalize trước đó). */
export function getTab(id: StudioTabId): StudioTab {
  return TABS.find((t) => t.id === id) ?? TABS[0];
}