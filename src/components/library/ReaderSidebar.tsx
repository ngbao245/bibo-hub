import { useState, type ReactNode } from 'react';
import { List, Highlighter, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SidebarTab = 'toc' | 'highlights' | 'search';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTab?: SidebarTab;
  /** Render function cho từng tab — caller cung cấp content theo từng reader */
  renderToc: () => ReactNode;
  renderHighlights: () => ReactNode;
  renderSearch?: () => ReactNode;
}

/**
 * Drawer sidebar trượt từ trái cho reader. 3 tabs: TOC / Highlights / Search.
 * Visible (open=true) → đẩy main content sang phải; close → trượt ra ngoài.
 *
 * Mobile: drawer overlay full-screen. Desktop: 320px sidebar.
 */
export default function ReaderSidebar({
  open,
  onClose,
  defaultTab = 'toc',
  renderToc,
  renderHighlights,
  renderSearch,
}: Props) {
  const [tab, setTab] = useState<SidebarTab>(defaultTab);

  return (
    <>
      {/* Backdrop trên mobile */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={cn(
          'absolute left-0 top-0 z-40 flex h-full w-80 flex-col border-r border-zinc-800 bg-zinc-950 transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <div className="flex">
            <TabButton active={tab === 'toc'} onClick={() => setTab('toc')} icon={<List className="h-3.5 w-3.5" />}>
              TOC
            </TabButton>
            <TabButton
              active={tab === 'highlights'}
              onClick={() => setTab('highlights')}
              icon={<Highlighter className="h-3.5 w-3.5" />}
            >
              Notes
            </TabButton>
            {renderSearch && (
              <TabButton
                active={tab === 'search'}
                onClick={() => setTab('search')}
                icon={<Search className="h-3.5 w-3.5" />}
              >
                Search
              </TabButton>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'toc' && renderToc()}
          {tab === 'highlights' && renderHighlights()}
          {tab === 'search' && renderSearch?.()}
        </div>
      </aside>
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-sky-500 text-zinc-100'
          : 'border-transparent text-zinc-500 hover:text-zinc-300',
      )}
    >
      {icon}
      {children}
    </button>
  );
}