
import type { ModalId } from '@/stores/modalStore';

// ============================================================
// Danh sách tools - single source of truth
// ============================================================
//
// File này list metadata tĩnh cho từng tool: id, label, action, description,
// và group (dùng cho Shortcuts modal). KHÔNG quyết định tool nằm ở category
// nào trên HubPro — mapping category là dynamic.
//
// Icon: render qua `<ToolIcon id={tool.id} />` (xem ToolIcon.tsx).
// Tool ID phải khớp với key trong ICON_MAP của ToolIcon.
//
// Phím tắt: KHÔNG khai báo ở đây. Shortcut là dynamic — user gán qua
// Setting → lưu /Config → bootstrap load vào shortcutStore. Xem
// `src/lib/shortcutRegistry.ts` và `src/stores/shortcutStore.ts`.
//
// Category trên HubPro: dynamic — user kéo-thả tool giữa 6 category fix cứng
// (Productivity, Finance, Tracking, Utilities, Developer, Admin) qua Setting →
// Tool Categories. Lưu MockAPI record group="Setting" type="Category".
// Xem `src/components/ToolCategoryManager.tsx` và `src/api/toolCategories.ts`.
// Default state (user chưa config): tất cả tool ở section "Unassigned".
// ============================================================

export type ToolKind =
  /** Mở modal toàn cục (Calculator, Translate...) */
  | { kind: 'modal'; modalId: ModalId }
  /** Điều hướng tới page (Notes, Tasks, Movies...) */
  | { kind: 'route'; path: string }
  /** Chưa implement, click → alert tạm thời */
  | { kind: 'todo' };

export interface Tool {
  id: string;
  label: string;
  /**
   * Nhóm logic của tool — dùng làm section header trong Shortcuts modal.
   * KHÔNG phải category assignment cho HubPro (cái đó dynamic qua Setting).
   */
  group: ToolGroup;
  action: ToolKind;
  /** Mô tả ngắn, dùng ở HubPro tile hover */
  description?: string;
}

/**
 * 6 category fix cứng. User KHÔNG thêm/xoá được. Nhưng tool nào ở category nào
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
    description: 'Rich text note-taking với highlight và shortcut',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    group: 'Productivity',
    action: { kind: 'route', path: '/tasks' },
    description: 'Task management theo style Microsoft To Do',
  },
  {
    id: 'sources',
    label: 'Sources',
    group: 'Productivity',
    action: { kind: 'route', path: '/sources' },
    description: 'Quản lý nguồn tài liệu và link',
  },
  {
    id: 'secret',
    label: 'Secret',
    group: 'Productivity',
    action: { kind: 'modal', modalId: 'secret' },
    description: 'Notes mã hóa bằng password',
  },
  {
    id: 'readest',
    label: 'Reader',
    group: 'Productivity',
    action: { kind: 'route', path: '/reader' },
    description: 'PDF reader với highlight, note, translate',
  },
  {
    id: 'markdown-preview',
    label: 'Markdown',
    group: 'Productivity',
    action: { kind: 'route', path: '/markdown' },
    description: 'Markdown editor + live preview, export PDF',
  },
  {
    id: 'json-viewer',
    label: 'JSON Viewer',
    group: 'Productivity',
    action: { kind: 'route', path: '/json-viewer' },
    description: 'Visualize JSON/CSV bằng graph hoặc tree, import/export',
  },
  {
    id: 'rag',
    label: 'AI Search',
    group: 'Productivity',
    action: { kind: 'modal', modalId: 'rag' },
    description: 'Semantic search + AI chat trên notes / tasks / highlights',
  },

  // Finance
  {
    id: 'savings',
    label: 'Saving',
    group: 'Finance',
    action: { kind: 'modal', modalId: 'savings' },
    description: 'Theo dõi tiết kiệm hàng tháng',
  },
  {
    id: 'expense',
    label: 'Chi tiêu',
    group: 'Finance',
    action: { kind: 'route', path: '/expense' },
    description: 'Ghi chép chi tiêu cá nhân',
  },

  // Tracking
  {
    id: 'spx',
    label: 'SPX Tracking',
    group: 'Tracking',
    action: { kind: 'modal', modalId: 'spxTracking' },
    description: 'Theo dõi đơn hàng SPX',
  },
  {
    id: 'movies',
    label: 'Movies',
    group: 'Tracking',
    action: { kind: 'route', path: '/movies' },
    description: 'Danh sách phim đã xem và muốn xem',
  },

  // Utilities
  {
    id: 'translate',
    label: 'Translate',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'translate' },
    description: 'Dịch Việt-Anh tự động',
  },
  {
    id: 'calculator',
    label: 'Calculator',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'calculator' },
    description: 'Máy tính cơ bản',
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
    description: 'Mã hoá / giải mã AES-GCM (dùng chung passphrase với Setting)',
  },
  {
    id: 'audio',
    label: 'Audio',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'audio' },
    description: 'Phát nhạc YouTube nền — playlist + floating window',
  },

  // Developer
  {
    id: 'p2p-transfer',
    label: 'P2P Transfer',
    group: 'Developer',
    action: { kind: 'route', path: '/p2p' },
    description: 'Truyền file ngang hàng qua WebRTC',
  },
  {
    id: 'keycap',
    label: 'Retailing',
    group: 'Developer',
    action: { kind: 'route', path: '/keycap' },
    description: 'Quản lý sản phẩm bán lẻ',
  },
  {
    id: 'code-compare',
    label: 'Compare',
    group: 'Developer',
    action: { kind: 'route', path: '/code-compare' },
    description: 'So sánh 2 đoạn code — inline diff',
  },

  // Admin
  {
    id: 'backup',
    label: 'Backup',
    group: 'Admin',
    action: { kind: 'modal', modalId: 'backup' },
    description: 'Export/import data',
  },
  {
    id: 'project-packer',
    label: 'Project Packer',
    group: 'Admin',
    action: { kind: 'route', path: '/project-packer' },
    description: 'Đóng gói project source code',
  },
  {
    id: 'setting',
    label: 'Config',
    group: 'Admin',
    action: { kind: 'route', path: '/setting' },
    description: 'Quản lý setting dự án (CRUD qua mockapi)',
  },
  {
    id: 'cache-inspector',
    label: 'Cache',
    group: 'Admin',
    action: { kind: 'modal', modalId: 'cacheInspector' },
    description: 'Xem & quản lý cache',
  },
];

/**
 * Group tools theo `Tool.group` — dùng cho Shortcuts modal section header.
 * KHÔNG dùng làm layout cho HubPro (đó là dynamic qua ToolCategoryManager).
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