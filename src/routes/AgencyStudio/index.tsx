// ============================================================
// Agency Studio — Layout + nested router
// ============================================================
// Route: /agency-studio/*
// Sidebar (240px) + top bar + <Outlet />
// ============================================================

import { lazy, Suspense, useState } from 'react';
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Mail,
  Megaphone,
  FileText,
  ChevronLeft,
  Settings2,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
import { LoadingState } from '@/components/shared';

const Dashboard = lazy(() => import('./Dashboard'));
const Leads = lazy(() => import('./Leads'));
const LeadDetail = lazy(() => import('./LeadDetail'));
const Templates = lazy(() => import('./Templates'));
const Campaigns = lazy(() => import('./Campaigns'));
const CampaignCreate = lazy(() => import('./CampaignCreate'));
const EmailLogs = lazy(() => import('./EmailLogs'));
const Settings = lazy(() => import('./Settings'));

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/agency-studio', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agency-studio/leads', label: 'Leads', icon: Users },
  { to: '/agency-studio/templates', label: 'Templates', icon: FileText },
  { to: '/agency-studio/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/agency-studio/email-logs', label: 'Email Logs', icon: Mail },
  { to: '/agency-studio/settings', label: 'Settings', icon: Settings2 },
];

export default function AgencyStudioLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="flex h-full bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-background transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Agency Studio</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="text-muted-foreground hover:text-foreground lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/agency-studio'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: back + admin config link */}
        <div className="border-t border-border p-2 space-y-0.5">
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/config')}
              className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Settings2 className="h-4 w-4 shrink-0" />
              Email Config
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            Back to Hub
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground hover:text-foreground lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex-1 lg:flex-none" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<LoadingState label="Đang tải..." />}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="leads" element={<Leads />} />
              <Route path="leads/:id" element={<LeadDetail />} />
              <Route path="templates" element={<Templates />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="campaigns/new" element={<CampaignCreate />} />
              <Route path="email-logs" element={<EmailLogs />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/agency-studio" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}