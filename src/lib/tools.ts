
import type { ModalId } from '@/stores/modalStore';

// ============================================================
// Danh s├ích tools - single source of truth
// ============================================================
//
// File n├áy list metadata t─⌐nh cho tß╗½ng tool: id, label, action, description,
// v├á group (d├╣ng cho Shortcuts modal). KH├öNG quyß║┐t ─æß╗ïnh tool nß║▒m ß╗ƒ category
// n├áo tr├¬n HubPro ΓÇö mapping category l├á dynamic.
//
// Icon: render qua `<ToolIcon id={tool.id} />` (xem ToolIcon.tsx).
// Tool ID phß║úi khß╗¢p vß╗¢i key trong ICON_MAP cß╗ºa ToolIcon.
//
// Ph├¡m tß║»t: KH├öNG khai b├ío ß╗ƒ ─æ├óy. Shortcut l├á dynamic ΓÇö user g├ín qua
// Setting ΓåÆ l╞░u /Config ΓåÆ bootstrap load v├áo shortcutStore. Xem
// `src/lib/shortcutRegistry.ts` v├á `src/stores/shortcutStore.ts`.
//
// Category tr├¬n HubPro: dynamic ΓÇö user k├⌐o-thß║ú tool giß╗»a 6 category fix cß╗⌐ng
// (Productivity, Finance, Tracking, Utilities, Developer, Admin) qua Setting ΓåÆ
// Tool Categories. L╞░u MockAPI record group="Setting" type="Category".
// Xem `src/components/ToolCategoryManager.tsx` v├á `src/api/toolCategories.ts`.
// Default state (user ch╞░a config): tß║Ñt cß║ú tool ß╗ƒ section "Unassigned".
// ============================================================

export type ToolKind =
  /** Mß╗ƒ modal to├án cß╗Ñc (Calculator, Translate...) */
  | { kind: 'modal'; modalId: ModalId }
  /** ─Éiß╗üu h╞░ß╗¢ng tß╗¢i page (Notes, Tasks, Movies...) */
  | { kind: 'route'; path: string }
  /** Ch╞░a implement, click ΓåÆ alert tß║ím thß╗¥i */
  | { kind: 'todo' };

export interface Tool {
  id: string;
  label: string;
  /**
   * Nh├│m logic cß╗ºa tool ΓÇö d├╣ng l├ám section header trong Shortcuts modal.
   * KH├öNG phß║úi category assignment cho HubPro (c├íi ─æ├│ dynamic qua Setting).
   */
  group: ToolGroup;
  action: ToolKind;
  /** M├┤ tß║ú ngß║»n, d├╣ng ß╗ƒ HubPro tile hover */
  description?: string;
}

/**
 * 6 category fix cß╗⌐ng. User KH├öNG th├¬m/xo├í ─æ╞░ß╗úc. Nh╞░ng tool n├áo ß╗ƒ category n├áo
 * l├á dynamic, chß╗ënh qua /setting ΓåÆ Tool Categories.
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
    description: 'Rich text note-taking vß╗¢i highlight v├á shortcut',
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
    description: 'Zero-knowledge encrypted secrets ΓÇö notes, accounts, cards',
  },
  {
    id: 'library',
    label: 'Library',
    group: 'Productivity',
    action: { kind: 'route', path: '/library' },
    description: 'Th╞░ viß╗çn s├ích shared ΓÇö ─æß╗ìc, highlight, note, translate',
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
    description: 'JSON toolkit ΓÇö visualize, format, diff, convert, path, schema',
  },
  {
    id: 'rag',
    label: 'AI Search',
    group: 'Productivity',
    action: { kind: 'modal', modalId: 'rag' },
    description: 'Semantic search + AI chat tr├¬n notes / tasks / highlights',
  },

  // Finance
  {
    id: 'expense',
    label: 'Chi ti├¬u',
    group: 'Finance',
    action: { kind: 'route', path: '/expense' },
    description: 'Ghi ch├⌐p chi ti├¬u c├í nh├ón',
  },

  // Tracking
  {
    id: 'spx',
    label: 'SPX Tracking',
    group: 'Tracking',
    action: { kind: 'modal', modalId: 'spxTracking' },
    description: 'Theo d├╡i ─æ╞ín h├áng SPX',
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
    description: 'Quß║ún l├╜ lead v├á email outreach ΓÇö Lead ΓåÆ Template ΓåÆ Campaign ΓåÆ Track',
  },

  // Utilities
  {
    id: 'translate',
    label: 'Translate',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'translate' },
    description: 'Dß╗ïch Viß╗çt-Anh tß╗▒ ─æß╗Öng',
  },
  {
    id: 'calculator',
    label: 'Calculator',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'calculator' },
    description: 'M├íy t├¡nh c╞í bß║ún',
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
    description: 'M├ú ho├í / giß║úi m├ú AES-GCM (d├╣ng chung passphrase vß╗¢i Setting)',
  },
  {
    id: 'audio',
    label: 'Audio',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'audio' },
    description: 'Ph├ít nhß║íc YouTube nß╗ün ΓÇö playlist + floating window',
  },

  // Developer
  {
    id: 'p2p-transfer',
    label: 'P2P Transfer',
    group: 'Developer',
    action: { kind: 'route', path: '/p2p' },
    description: 'Truyß╗ün file ngang h├áng qua WebRTC',
  },
  {
    id: 'code-compare',
    label: 'Compare',
    group: 'Developer',
    action: { kind: 'route', path: '/code-compare' },
    description: 'So s├ính 2 ─æoß║ín code ΓÇö inline diff',
  },
  {
    id: 'design-system',
    label: 'Design System',
    group: 'Developer',
    action: { kind: 'route', path: '/design-system' },
    description: 'Internal ΓÇö preview theme tokens, components, variants',
  },

  // Admin
  {
    id: 'portfolio-landing',
    label: 'Portfolio',
    group: 'Admin',
    action: { kind: 'route', path: '/portfolio' },
    description: 'Public landing page b├ín dß╗ïch vß╗Ñ ΓÇö polygon 3D hero',
  },
  {
    id: 'project-packer',
    label: 'Project Packer',
    group: 'Admin',
    action: { kind: 'route', path: '/project-packer' },
    description: '─É├│ng g├│i project source code',
  },
  {
    id: 'setting',
    label: 'Config',
    group: 'Admin',
    action: { kind: 'route', path: '/config' },
    description: 'Quß║ún l├╜ setting dß╗▒ ├ín (CRUD qua mockapi)',
  },
  {
    id: 'home-widgets',
    label: 'Home Widgets',
    group: 'Productivity',
    action: { kind: 'route', path: '/' },
    description: 'Widget system tr├¬n HubPro homepage ΓÇö daily reminder, quick actions',
  },
];

/**
 * Group tools theo `Tool.group` ΓÇö d├╣ng cho Shortcuts modal section header.
 * KH├öNG d├╣ng l├ám layout cho HubPro (─æ├│ l├á dynamic qua ToolCategoryManager).
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