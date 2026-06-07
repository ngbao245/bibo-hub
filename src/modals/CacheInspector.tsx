import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Database, HardDrive, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

import { useShortcut } from '@/hooks/useShortcut';
import { useModalStore } from '@/stores/modalStore';
import ToolModal from '@/components/ToolModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';

import QueryCacheTab from '@/components/cache/QueryCacheTab';
import LocalStorageTab from '@/components/cache/LocalStorageTab';

// ============================================================
// Cache Inspector Modal — Alt+I
// ============================================================
//
// 2 tabs:
// - Query Cache: TanStack Query state (server data)
// - LocalStorage: browser localStorage (settings + UI state)
//
// + Clear All button — xoá toàn bộ + reload trang
// ============================================================

export default function CacheInspector() {
  const toggle = useModalStore((s) => s.toggle);
  const handleShortcut = useCallback(() => toggle('cacheInspector'), [toggle]);

  useShortcut({
    key: 'alt+i',
    label: 'Cache Inspector',
    group: 'Tools',
    handler: handleShortcut,
  });

  return (
    <ToolModal
      id="cacheInspector"
      title="Cache Inspector"
      description="Xem và quản lý cache của ứng dụng"
      className="max-w-5xl"
    >
      <CacheContent />
    </ToolModal>
  );
}

function CacheContent() {
  const qc = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  function clearAll() {
    if (!window.confirm('Xoá TOÀN BỘ cache (Query + LocalStorage) và reload trang?\n\nKhông thể hoàn tác.')) return;
    qc.clear();
    localStorage.clear();
    toast.success('Đã xoá hết cache. Đang reload...');
    setTimeout(() => window.location.reload(), 500);
  }

  return (
    <div className="space-y-3">
      {/* Header với nút Clear All + Refresh */}
      <div className="flex items-center justify-between border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
          <span>Xoá cache có thể làm mất dữ liệu chưa save. Cẩn thận.</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} className="h-7 gap-1.5 px-2 text-xs">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={clearAll} className="h-7 gap-1.5 px-2 text-xs">
            <Trash2 className="h-3 w-3" />
            Clear All + Reload
          </Button>
        </div>
      </div>

      <Tabs defaultValue="query">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="query" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Query Cache
          </TabsTrigger>
          <TabsTrigger value="local" className="gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            LocalStorage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="query" className="mt-3">
          <QueryCacheTab refreshKey={refreshKey} onChange={refresh} />
        </TabsContent>

        <TabsContent value="local" className="mt-3">
          <LocalStorageTab refreshKey={refreshKey} onChange={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
