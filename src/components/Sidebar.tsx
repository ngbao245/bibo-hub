import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

// ============================================================
// Sidebar - sidebar dùng chung cho mọi page
// ============================================================
//
// THAY THẾ: code sidebar lặp lại trong hub.html, notes.html, tasks.html.
// Mỗi page chỉ cần truyền `title` và (optional) `children` cho phần body.
//
// Mobile: sidebar overlay khi class `mobile-visible`. State đó do
// MobileHeader quản lý qua prop `isOpen`.
// ============================================================

interface SidebarProps {
  title: string;
  /** Có hiển thị sidebar trên mobile không (do hamburger điều khiển) */
  isOpenOnMobile?: boolean;
  /** Nội dung body (list notes, list tasks...) */
  children?: ReactNode;
  /** Action ở header (ví dụ button New) */
  headerAction?: ReactNode;
}

export default function Sidebar({
  title,
  isOpenOnMobile = false,
  children,
  headerAction,
}: SidebarProps) {
  return (
    <aside
      className={[
        'flex w-[280px] flex-col overflow-hidden border-r border-border bg-bg-secondary',
        // Mobile: fixed overlay, ẩn mặc định, hiện khi isOpenOnMobile
        'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[1000] max-md:transition-transform max-md:duration-normal',
        isOpenOnMobile ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
      ].join(' ')}
    >
      <div className="flex items-center justify-between border-b border-border bg-bg-hover px-3 py-2">
        <h3 className="text-text-secondary text-sm font-normal uppercase tracking-wide">
          {title}
        </h3>
        {headerAction}
      </div>

      {/* Navigation links */}
      <nav className="flex border-b border-border">
        <NavLink to="/" className={navLinkClass} end>
          Hub
        </NavLink>
        <NavLink to="/notes" className={navLinkClass}>
          Notes
        </NavLink>
        <NavLink to="/tasks" className={navLinkClass}>
          Tasks
        </NavLink>
      </nav>

      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

// Hàm trả về class cho NavLink dựa vào isActive (React Router v6 pattern)
function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex-1 px-3 py-2 text-center text-sm transition-colors',
    isActive
      ? 'bg-bg-elevated text-accent border-b-2 border-accent'
      : 'text-text-muted hover:bg-bg-elevated hover:text-text-primary',
  ].join(' ');
}
