import type { ModalId } from '@/stores/modalStore';

// ============================================================
// Danh sách tools trên Hub - single source of truth
// ============================================================
//
// Cả Hub original và HubPro đều đọc từ đây.
// Khi thêm tool mới, sửa 1 chỗ duy nhất.
//
// Icon được render qua `<ToolIcon id={tool.id} />` (xem ToolIcon.tsx).
// Tool ID phải khớp với key trong ICON_MAP của ToolIcon.
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
  shortcut?: string;
  /** Nhóm hiển thị ở HubPro (Productivity, Finance, Utilities...) */
  group: ToolGroup;
  action: ToolKind;
  /** Mô tả ngắn, dùng ở HubPro */
  description?: string;
}

export type ToolGroup =
  | 'Productivity'
  | 'Finance'
  | 'Utilities'
  | 'Tracking'
  | 'Developer';

export const TOOLS: Tool[] = [
  // Productivity
  {
    id: 'notes',
    label: 'Notes',
    shortcut: 'Alt+N',
    group: 'Productivity',
    action: { kind: 'route', path: '/notes' },
    description: 'Rich text note-taking với highlight và shortcut',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    shortcut: 'Alt+D',
    group: 'Productivity',
    action: { kind: 'route', path: '/tasks' },
    description: 'Task management theo style Microsoft To Do',
  },
  {
    id: 'sources',
    label: 'Sources',
    shortcut: 'Alt+P',
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
    shortcut: 'Alt+T',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'translate' },
    description: 'Dịch Việt-Anh tự động',
  },
  {
    id: 'calculator',
    label: 'Calculator',
    shortcut: 'Alt+C',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'calculator' },
    description: 'Máy tính cơ bản',
  },
  {
    id: 'encoder',
    label: 'Encoder',
    shortcut: 'Alt+E',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'encoder' },
    description: 'Encode API URL cho config.js',
  },
  {
    id: 'backup',
    label: 'Backup',
    shortcut: 'Alt+B',
    group: 'Utilities',
    action: { kind: 'modal', modalId: 'backup' },
    description: 'Export/import data',
  },

  // Developer
  {
    id: 'project-packer',
    label: 'Project Packer',
    group: 'Developer',
    action: { kind: 'route', path: '/project-packer' },
    description: 'Đóng gói project source code',
  },
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
    id: 'cache-inspector',
    label: 'Cache',
    shortcut: 'Alt+I',
    group: 'Developer',
    action: { kind: 'modal', modalId: 'cacheInspector' },
    description: 'Xem & quản lý cache',
  },
];

// Nhóm tools theo group (cho HubPro hiển thị section)
export function groupTools(tools: Tool[]): Record<ToolGroup, Tool[]> {
  const result: Record<ToolGroup, Tool[]> = {
    Productivity: [],
    Finance: [],
    Tracking: [],
    Utilities: [],
    Developer: [],
  };
  for (const t of tools) result[t.group].push(t);
  return result;
}
