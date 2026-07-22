
import type { ModalId } from '@/stores/modalStore';

// ============================================================
// Danh sách tools - single source of truth
// ============================================================
//
// File này list metadata t─⌐nh cho từng tool: id, label, action, description,
// vă group (dùng cho Shortcuts modal). KH├öNG quyß║┐t định tool nằm ở category
// năo trênn HubPro — mapping category là dynamic.
//
// Icon: render qua `<ToolIcon id={tool.id} />` (xem ToolIcon.tsx).
// Tool ID phải khß╗¢p với key trong ICON_MAP của ToolIcon.
//
// Phảm tß║»t: KH├öNG khai báo ở đ├óy. Shortcut là dynamic — user gán qua
// Setting → lưu /Config → bootstrap load vào shortcutStore. Xem
// `src/lib/shortcutRegistry.ts` vă `src/stores/shortcutStore.ts`.
//
// Category trênn HubPro: dynamic — user k├⌐o-thß║ú tool giữa 6 category fix cß╗⌐ng
// (Productivity, Finance, Tracking, Utilities, Developer, Admin) qua Setting →
// Tool Categories. Lưu MockAPI record group="Setting" type="Category".
// Xem `src/components/ToolCategoryManager.tsx` vă `src/api/toolCategories.ts`.
// Default state (user ch╞░a config): tất cả tool ở section "Unassigned".
// ============================================================

export type ToolKind =
  /** Mở modal toàn cß╗Ñc (Calculator, Translate...) */
  | { kind: 'modal'; modalId: ModalId }
  /** ─Éiß╗üu h╞░ß╗¢ng tß╗¢i page (Notes, Tasks, Movies...) */
  | { kind: 'route'; path: string }
  /** Ch╞░a implement, click → alert tß║ím thß╗¥i */
  | { kind: 'todo' };

export interface Tool {
  id: string;
  label: string;
  /**
   * Nhốm logic của tool — dùng làm section header trong Shortcuts modal.
   * KH├öNG phải category assignment cho HubPro (cái đó dynamic qua Setting).
   */
  group: ToolGroup;
  action: ToolKind;
  /** Mổ tß║ú ngß║»n, dùng ở HubPro tile hover */
  description?: string;
}

/**
 * 6 category fix cß╗⌐ng. User KH├öNG thêm/xoá được. Nh╞░ng tool năo ở category năo
 * là dynamic, chỉnh qua /setting → Tool Categories.
 */
export type ToolGroup =
  | 'Productivity'
  | 'Finance'
  | 'Tracking'
  | 'Utilities'
  | 'Developer'
  | 'Admin';

export const TOOL_GROUPS: readonly ToolGroup[] = [
  'Productivity',
  'Finance',
  'Tracking',
  'Utilities',
  'Developer',
  'Admin',
] as const;

export const TOOLS: Tool[] = [
  // Productivity
  {
    id: 'notes',
    label: 'Notes',
    group: 'Productivity',
    action: { kind: 'route', path: '/notes' },
    description: 'Rich text note-taking với highlight vă shortcut',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    group: 'Productivity',
    action: { kind: 'route', path: '/tasks' },
    description: 'Task management theo style Microsoft To Do',
  },
  {
    id: 'vault',
    label: 'Vault',
    group: 'Utilities',
    action: { kind: 'route', path: '/vault' },
    description: 'Zero-knowledge encrypted secrets — notes, accounts, cards',
  },
  {
    id: 'library',
    label: 'Library',
    group: 'Productivity',
    action: { kind: 'route', path: '/library' },
    description: 'Th╞░ viß╗çn sách shared — đọc, highlight, note, translate',
  },
  {
    id: 'markdown-preview',
    label: 'Markdown',
    group: 'Productivity',
    action: { kind: 'route', path: '/markdown' },
    description: 'Markdown editor + live preview, export PDF',
  },
  {
    id: 'json-studio',
    label: 'JSON Studio',
    group: 'Developer',
    action: { kind: 'route', path: '/json-studio' },
    description: 'JSON toolkit — visualize, format, diff, convert, path, schema',
  },
  {
    id: 'rag',
    label: 'AI Search',
    group: 'Productivity',
    action: { kind: 'modal', modalId: 'rag' },
    description: 'Semantic search + AI chat trênn notes / tasks / highlights',
  },

  // Finance
  {
    id: 'expense',
    label: 'Chi ti├¬u',
    group: 'Finance',
    action: { kind: 'route', path: '/expense' },
    description: 'Ghi ch├⌐p chi ti├¬u cá nh├ón',
  },

  // Tracking
  {
    id: 'spx',
    label: 'SPX Tracking',
    group: 'Tracking',
    action: { kind: 'modal', modalId: 'spxTracking' },
    description: 'Theo d├╡i đ╞ín hăng SPX',
  },
  {
    id: 'bookmarks',
    label: 'Bookmarks',
    group: 'Tracking',
    action: { kind: 'route', path: '/bookmarks' },
    description: 'Theo d├╡i phim, series, manga, anime',
  },
  {
    id: 'agency-studio',
    label: 'Agency Studio',
    group: 'Tracking',
    action: { kind: 'route', path: '/agency-studio' },
    description: 'Quß║ún lừ lead vă email outreach — Lead → Template → Campaign → Track',
  },

  // Utilities
  {
    id: 'translate',
    label: 'Translate',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'translate' },
    description: 'Dß╗ïch Viß╗çt-Anh tự động',
  },
  {
    id: 'calculator',
    label: 'Calculator',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'calculator' },
    description: 'Máy tảnh c╞í bß║ún',
  },
  {
    id: 'encoder',
    label: 'Encoder',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'encoder' },
    description: 'Encode API URL cho config.js',
  },
  {
    id: 'crypto',
    label: 'Crypto',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'crypto' },
    description: 'Mắ hoá / giß║úi mắ AES-GCM (dùng chung passphrase với Setting)',
  },
  {
    id: 'audio',
    label: 'Audio',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'audio' },
    description: 'Phát nhß║íc YouTube nß╗ün — playlist + floating window',
  },

  // Developer
  {
    id: 'p2p-transfer',
    label: 'P2P Transfer',
    group: 'Developer',
    action: { kind: 'route', path: '/p2p' },
    description: 'Truyß╗ün file ngang hăng qua WebRTC',
  },
  {
    id: 'code-compare',
    label: 'Compare',
    group: 'Developer',
    action: { kind: 'route', path: '/code-compare' },
    description: 'So sánh 2 đoß║ín code — inline diff',
  },
  {
    id: 'design-system',
    label: 'Design System',
    group: 'Developer',
    action: { kind: 'route', path: '/design-system' },
    description: 'Internal — preview theme tokens, components, variants',
  },

  // Admin
  {
    id: 'portfolio-landing',
    label: 'Portfolio',
    group: 'Admin',
    action: { kind: 'route', path: '/portfolio' },
    description: 'Public landing page bán dß╗ïch vß╗Ñ — polygon 3D hero',
  },
  {
    id: 'project-packer',
    label: 'Project Packer',
    group: 'Admin',
    action: { kind: 'route', path: '/project-packer' },
    description: '─Éống gối project source code',
  },
  {
    id: 'setting',
    label: 'Config',
    group: 'Admin',
    action: { kind: 'route', path: '/config' },
    description: 'Quß║ún lừ setting dß╗▒ án (CRUD qua mockapi)',
  },
  {
    id: 'home-widgets',
    label: 'Home Widgets',
    group: 'Productivity',
    action: { kind: 'route', path: '/' },
    description: 'Widget system trênn HubPro homepage — daily reminder, quick actions',
  },
];

/**
 * Group tools theo `Tool.group` — dùng cho Shortcuts modal section header.
 * KH├öNG dùng làm layout cho HubPro (đó là dynamic qua ToolCategoryManager).
 */
export function groupTools(tools: Tool[]): Record<ToolGroup, Tool[]> {
  const result: Record<ToolGroup, Tool[]> = {
    Productivity: [],
    Finance: [],
    Tracking: [],
    Utilities: [],
    Developer: [],
    Admin: [],
  };
  for (const t of tools) result[t.group].push(t);
  return result;
}
