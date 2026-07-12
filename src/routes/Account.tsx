import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';

import { cn } from '@/lib/cn';
import ProfileTab from '@/components/setting/ProfileTab';
import ShortcutManager from '@/components/ShortcutManager';
import ToolCategoryManager from '@/components/ToolCategoryManager';

type TabId = 'profile' | 'categories' | 'shortcuts';

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'categories', label: 'Categories' },
  { id: 'shortcuts', label: 'Shortcuts' },
];

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Hub
          </Link>
          <span className="text-xs text-muted-foreground">/</span>
          <User className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-medium text-foreground">My Account</h1>
        </div>
      </div>

      {/* Tab navigation */}
      <nav className="flex border-b border-border bg-muted/30">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 border-b-2 py-2.5 text-center text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'categories' && (
          <ToolCategoryManager onClose={() => {}} />
        )}
        {activeTab === 'shortcuts' && <ShortcutManager />}
      </div>
    </div>
  );
}