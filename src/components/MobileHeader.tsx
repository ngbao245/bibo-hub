// ============================================================
// MobileHeader - header có hamburger button, chỉ hiển thị ≤768px
// ============================================================
//
// THAY THẾ: 4 file *-mobile.js cũ. Giờ là 1 component dùng chung.
// Parent page giữ state `sidebarOpen`, truyền vào đây + Sidebar.
// ============================================================

import { Menu } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  onToggleSidebar: () => void;
}

export default function MobileHeader({ title, onToggleSidebar }: MobileHeaderProps) {
  return (
    <header className="hidden items-center gap-4 border-b border-border bg-bg-secondary px-4 py-3 max-md:flex">
      <button
        onClick={onToggleSidebar}
        className="text-text-primary hover:text-accent transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-6 w-6" />
      </button>
      <h2 className="text-text-primary text-lg font-medium">{title}</h2>
    </header>
  );
}
