// ============================================================
// Cache Inspector Panel — embedded in Setting (non-modal version)
// ============================================================

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';

import QueryCacheTab from '@/components/cache/QueryCacheTab';
import LocalStorageTab from '@/components/cache/LocalStorageTab';
import IndexedDBTab from '@/components/cache/IndexedDBTab';
import { clearStore, STORE_COVERS, STORE_FILES } from '@/tools/library/lib/blob-cache';

export default function CacheInspectorPanel() {
  const qc = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  async function clearAll() {
    if (!window.confirm('Clear all cache? Removes Query cache, LocalStorage, and IndexedDB. The page will reload.')) return;
    qc.clear();
    localStorage.clear();
    void Promise.all([clearStore(STORE_FILES), clearStore(STORE_COVERS)]);
    toast.success('Cache cleared. Reloading...');
    setTimeout(() => window.location.reload(), 500);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Cache Inspector</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={clearAll} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Clear All
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
        <span>Clearing cache may cause unsaved data loss.</span>
      </div>

      <Tabs defaultValue="query" className="w-full">
        <TabsList>
          <TabsTrigger value="query">Query Cache</TabsTrigger>
          <TabsTrigger value="local">LocalStorage</TabsTrigger>
          <TabsTrigger value="idb">IndexedDB</TabsTrigger>
        </TabsList>
        <TabsContent value="query"><QueryCacheTab key={`q-${refreshKey}`} refreshKey={refreshKey} onChange={refresh} /></TabsContent>
        <TabsContent value="local"><LocalStorageTab key={`l-${refreshKey}`} refreshKey={refreshKey} onChange={refresh} /></TabsContent>
        <TabsContent value="idb"><IndexedDBTab key={`i-${refreshKey}`} refreshKey={refreshKey} onChange={refresh} /></TabsContent>
      </Tabs>
    </div>
  );
}