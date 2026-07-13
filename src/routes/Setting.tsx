// ============================================================
// Config page — sidebar master-detail layout
// ============================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Settings2,
  Users,
  Image,
  Brain,
  FileArchive,
  HardDrive,
  Radio,
  Network,
  Shield,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { useServiceProviders } from '@/api/service-registry';

import UserManagementTab from '@/components/setting/UserManagementTab';
import AvatarManagerTab from '@/components/setting/AvatarManagerTab';
import RoleManager from '@/components/setting/RoleManager';
import ProviderDetail from '@/components/setting/service-registry/ProviderDetail';

// ─── Sidebar sections ───────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  type: 'platform' | 'provider';
  providerCode?: string;
  category?: string;
}

const PLATFORM_ITEMS: NavItem[] = [
  { id: 'users', label: 'User Management', icon: Users, type: 'platform' },
  { id: 'roles', label: 'Roles', icon: Shield, type: 'platform' },
  { id: 'assets', label: 'Assets', icon: Image, type: 'platform' },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ai: Brain,
  pdf: FileArchive,
  conversion: FileArchive,
  storage: HardDrive,
  realtime: Radio,
  networking: Network,
};

export default function SettingPage() {
  const [activeSection, setActiveSection] = useState('users');
  const providersQuery = useServiceProviders();
  const providers = providersQuery.data ?? [];

  // Group providers by category
  const categories = new Map<string, typeof providers>();
  for (const p of providers) {
    const cat = p.category;
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(p);
  }

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-border bg-background">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Hub
          </Link>
          <span className="text-xs text-muted-foreground">/</span>
          <Settings2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Config</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Platform section */}
          <div>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Platform
            </p>
            {PLATFORM_ITEMS.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                active={activeSection === item.id}
                onClick={() => setActiveSection(item.id)}
              />
            ))}
          </div>

          {/* Provider sections by category */}
          {Array.from(categories.entries()).map(([cat, provs]) => (
            <div key={cat}>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </p>
              {provs.map((p) => (
                <SidebarItem
                  key={p.id}
                  item={{
                    id: p.code,
                    label: p.name,
                    icon: CATEGORY_ICONS[p.category] ?? Settings2,
                    type: 'provider',
                    providerCode: p.code,
                  }}
                  active={activeSection === p.code}
                  onClick={() => setActiveSection(p.code)}
                />
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Detail panel */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-6">
          {activeSection === 'users' && <UserManagementTab />}
          {activeSection === 'roles' && <RoleManager />}
          {activeSection === 'assets' && <AvatarManagerTab />}
          {activeSection !== 'users' && activeSection !== 'assets' && activeSection !== 'roles' && (
            <ProviderDetail providerCode={activeSection} />
          )}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}