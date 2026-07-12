// ============================================================
// Config page — admin tabs
// ============================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings2 } from 'lucide-react';

import { cn } from '@/lib/cn';

import CompressConfigTab from '@/components/setting/CompressConfigTab';
import DriveBackupTab from '@/components/setting/DriveBackupTab';
import GeminiCreditPoolTab from '@/components/setting/GeminiCreditPoolTab';
import P2PConfigTab from '@/components/setting/P2PConfigTab';
import UserManagementTab from '@/components/setting/UserManagementTab';
import AvatarManagerTab from '@/components/setting/AvatarManagerTab';

type TabId = 'library' | 'ai' | 'p2p' | 'setting' | 'avatars';

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'setting', label: 'General' },
  { id: 'library', label: 'Library' },
  { id: 'ai', label: 'AI Agentic' },
  { id: 'p2p', label: 'P2P' },
  { id: 'avatars', label: 'Avatars' },
];

export default function SettingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('setting');

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
          <Settings2 className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-medium text-foreground">Config</h1>
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
        {activeTab === 'library' && <LibraryContent />}
        {activeTab === 'ai' && <GeminiCreditPoolTab />}
        {activeTab === 'p2p' && <P2PConfigTab />}
        {activeTab === 'setting' && <UserManagementTab />}
        {activeTab === 'avatars' && <AvatarManagerTab />}
      </div>
    </div>
  );
}

function LibraryContent() {
  return (
    <div className="space-y-8">
      <CompressConfigTab />
      <div className="border-t border-border pt-6">
        <DriveBackupTab />
      </div>
    </div>
  );
}