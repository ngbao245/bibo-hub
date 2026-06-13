
import type { TOOLS as ToolsArr } from './tools';
import { TOOLS } from './tools';

// ============================================================
// Shortcut Registry — danh sách action có thể gán phím tắt
// ============================================================
//
// Mỗi entry là 1 action user có thể gán shortcut:
//   - Tool entry: id = `tool.<toolId>`, action = mở modal/route tương ứng
//   - Control entry: shortcut hệ thống (vd close modal)
//
// User gán key qua Setting → lưu vào /Config (shortcutOverrides).
// App khởi động → load overrides → register vào shortcutStore.
// ============================================================

export interface ShortcutEntry {
  id: string;
  label: string;
  group: string;
  /** Mô tả thêm (optional) */
  description?: string;
}

/** Build registry từ TOOLS + system controls */
export function buildShortcutRegistry(): ShortcutEntry[] {
  const tools: ShortcutEntry[] = TOOLS.map((t) => ({
    id: `tool.${t.id}`,
    label: t.label,
    group: t.group,
    description: t.description,
  }));

  const controls: ShortcutEntry[] = [
    {
      id: 'tool.shortcuts',
      label: 'Phím tắt',
      group: 'Controls',
    },
  ];

  return [...controls, ...tools];
}

/** Tool ID từ shortcut entry id ('tool.calculator' → 'calculator') */
export function getToolIdFromEntry(entryId: string): string | null {
  if (entryId.startsWith('tool.')) return entryId.slice(5);
  return null;
}

// Type helper — re-export
export type { ToolsArr };