// ============================================================
// Storage Nodes Manager — Setting UI component
// ============================================================

import { useState } from 'react';
import { HardDrive, Plus, Trash2, ToggleLeft, ToggleRight, Wifi } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { LoadingState, EmptyState, ErrorState } from '@/components/shared';

import {
  useStorageNodes,
  useAddStorageNode,
  useUpdateStorageNode,
  useRemoveStorageNode,
  useTestStorageNode,
} from '../api';
import type { StorageNode } from '../types';

export default function StorageNodesManager() {
  const nodesQuery = useStorageNodes();
  const [showAdd, setShowAdd] = useState(false);

  if (nodesQuery.isLoading) {
    return <LoadingState variant="skeleton" count={3} layout="list" itemClassName="h-16" />;
  }

  if (nodesQuery.isError) {
    return <ErrorState message="Failed to load storage nodes" onRetry={() => nodesQuery.refetch()} />;
  }

  const nodes = nodesQuery.data ?? [];
  const totalCapacity = nodes.reduce((s, n) => s + n.capacityBytes, 0);
  const totalUsed = nodes.reduce((s, n) => s + n.usedBytes, 0);

  return (
    <div className="space-y-4">
      {/* Header + total usage */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Storage Pool</h3>
          {nodes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatBytes(totalUsed)} / {formatBytes(totalCapacity)} ({Math.round((totalUsed / totalCapacity) * 100) || 0}%)
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Node
        </Button>
      </div>

      {/* Total usage bar */}
      {nodes.length > 0 && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(100, (totalUsed / totalCapacity) * 100)}%` }}
          />
        </div>
      )}

      {/* Nodes list */}
      {nodes.length === 0 ? (
        <EmptyState
          icon={HardDrive}
          title="No storage nodes"
          description="Add a Supabase project as storage node to start uploading books."
          action={<Button size="sm" onClick={() => setShowAdd(true)}>Add Node</Button>}
        />
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && <AddNodeForm onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// ── Node Card ──

function NodeCard({ node }: { node: StorageNode }) {
  const updateNode = useUpdateStorageNode();
  const removeNode = useRemoveStorageNode();
  const testNode = useTestStorageNode();

  const remaining = node.capacityBytes - node.usedBytes;
  const usedPct = Math.round((node.usedBytes / node.capacityBytes) * 100) || 0;
  const isActive = node.status === 'active';

  async function handleToggle() {
    const newStatus = isActive ? 'disabled' : 'active';
    try {
      await updateNode.mutateAsync({ id: node.id, status: newStatus });
      toast.success(`Node ${newStatus}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function handleTest() {
    try {
      await testNode.mutateAsync({
        url: node.url,
        serviceRoleKey: node.serviceRoleKey,
        bucketName: node.bucketName,
      });
      toast.success('Connection OK');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove "${node.name}"? Files on this node will NOT be deleted.`)) return;
    try {
      await removeNode.mutateAsync(node.id);
      toast.success('Removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="flex items-center gap-3 rounded border border-border p-3">
      <HardDrive className="h-5 w-5 shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{node.name}</span>
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            {isActive ? 'active' : 'disabled'}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{formatBytes(node.usedBytes)} / {formatBytes(node.capacityBytes)}</span>
          <span>({usedPct}%)</span>
          <span>remaining: {formatBytes(remaining)}</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${usedPct > 90 ? 'bg-destructive' : usedPct > 70 ? 'bg-warning' : 'bg-primary'}`}
            style={{ width: `${Math.min(100, usedPct)}%` }}
          />
        </div>
      </div>

      <div className="flex shrink-0 gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleTest} disabled={testNode.isPending}>
          {testNode.isPending ? <Wifi className="h-3.5 w-3.5 animate-pulse" /> : <Wifi className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleToggle}>
          {isActive ? <ToggleRight className="h-3.5 w-3.5 text-success" /> : <ToggleLeft className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={handleRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Add Node Form ──

function AddNodeForm({ onClose }: { onClose: () => void }) {
  const addNode = useAddStorageNode();
  const testNode = useTestStorageNode();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [bucketName, setBucketName] = useState('books');
  const [capacityGb, setCapacityGb] = useState('1');
  const [tested, setTested] = useState<boolean | null>(null);

  const valid = name.trim() && url.trim() && serviceRoleKey.trim();

  async function handleTest() {
    setTested(null);
    try {
      await testNode.mutateAsync({ url: url.trim(), serviceRoleKey: serviceRoleKey.trim(), bucketName: bucketName.trim() || 'books' });
      setTested(true);
      toast.success('Connection OK');
    } catch (err) {
      setTested(false);
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function handleAdd() {
    if (!valid) return;
    try {
      await addNode.mutateAsync({
        name: name.trim(),
        url: url.trim(),
        serviceRoleKey: serviceRoleKey.trim(),
        anonKey: anonKey.trim(),
        bucketName: bucketName.trim() || 'books',
        capacityBytes: Math.round(parseFloat(capacityGb) * 1073741824),
      });
      toast.success('Node added');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="space-y-3 rounded border border-border bg-card p-4">
      <h4 className="text-sm font-medium">Add Storage Node</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Node Alpha" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Capacity (GB)</label>
          <Input value={capacityGb} onChange={(e) => setCapacityGb(e.target.value)} placeholder="1" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Supabase URL</label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxx.supabase.co" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Service Role Key</label>
        <Input type="password" value={serviceRoleKey} onChange={(e) => setServiceRoleKey(e.target.value)} placeholder="eyJ..." />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Anon Key (for signed URLs)</label>
        <Input type="password" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJ..." />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Bucket Name</label>
        <Input value={bucketName} onChange={(e) => setBucketName(e.target.value)} placeholder="books" />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleTest} disabled={!url || !serviceRoleKey || testNode.isPending}>
          {testNode.isPending ? 'Testing...' : 'Test Connection'}
        </Button>
        {tested === true && <span className="text-xs text-success">OK</span>}
        {tested === false && <span className="text-xs text-destructive">Failed</span>}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleAdd} disabled={!valid || addNode.isPending}>
          {addNode.isPending ? 'Adding...' : 'Add Node'}
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ──

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}