// ============================================================
// CreditPoolManager — Admin UI for credit pools + quotas + usage
// ============================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Coins,
  Clock,
  Plus,
  Trash2,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';

import { authClient } from '@/lib/authClient';
import {
  useCreditPools,
  useCreditQuotas,
  useCreditUsage,
} from '@/lib/core-sdk';
import type { CreditPool, CreditPoolQuota, CreditUsageLog } from '@/lib/core-sdk/credits';
import { useServiceProviders } from '@/api/service-registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';

// ─── Helpers ────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// ─── Mutations ──────────────────────────────────────────────

function useCreatePool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      provider_id: string;
      code: string;
      name: string;
      credit_unit: string;
    }) => {
      const { data, error } = await authClient
        .from('credit_pools')
        .insert(input)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'credit-pools'] });
      toast.success('Pool created');
    },
  });
}

function useDeletePool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient.from('credit_pools').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'credit-pools'] });
      toast.success('Pool deleted');
    },
  });
}

function useCreateQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pool_id: string;
      window_type: string;
      max_credits: number;
      window_end: string;
    }) => {
      const { data, error } = await authClient
        .from('credit_pool_quotas')
        .insert({ ...input, window_start: new Date().toISOString() })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'credit-quotas'] });
      toast.success('Quota window added');
    },
  });
}

function useDeleteQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient.from('credit_pool_quotas').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'credit-quotas'] });
      toast.success('Quota removed');
    },
  });
}

// ─── Main ───────────────────────────────────────────────────

export default function CreditPoolManager() {
  const poolsQuery = useCreditPools();
  const providersQuery = useServiceProviders();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedPool, setExpandedPool] = useState<string | null>(null);

  if (poolsQuery.isLoading) {
    return <LoadingState variant="skeleton" count={3} layout="list" itemClassName="h-20 w-full" />;
  }
  if (poolsQuery.isError) {
    return <ErrorState message="Load credit pools fail" onRetry={() => poolsQuery.refetch()} />;
  }

  const pools = poolsQuery.data ?? [];
  const providers = providersQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Credit Pools</h2>
          <p className="text-xs text-muted-foreground">
            Quota management per provider. Pre-check before API calls.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Add Pool
        </Button>
      </div>

      {showCreate && (
        <CreatePoolForm
          providers={providers}
          onClose={() => setShowCreate(false)}
        />
      )}

      {pools.length === 0 && !showCreate && (
        <EmptyState
          icon={Coins}
          title="No credit pools"
          description="Add a pool to start tracking API quota usage."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Add pool
            </Button>
          }
        />
      )}

      <div className="space-y-2">
        {pools.map((pool) => (
          <PoolCard
            key={pool.id}
            pool={pool}
            providerName={providers.find((p) => p.id === pool.provider_id)?.name ?? 'Unknown'}
            isExpanded={expandedPool === pool.id}
            onToggle={() => setExpandedPool(expandedPool === pool.id ? null : pool.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Create Pool Form ───────────────────────────────────────

function CreatePoolForm({
  providers,
  onClose,
}: {
  providers: { id: string; name: string; code: string }[];
  onClose: () => void;
}) {
  const mut = useCreatePool();
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('requests');

  function handleSubmit() {
    if (!providerId || !code.trim() || !name.trim()) {
      toast.error('Provider, code, and name are required');
      return;
    }
    mut.mutate(
      { provider_id: providerId, code: code.trim(), name: name.trim(), credit_unit: unit.trim() },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <div className="space-y-3 border border-border p-4">
      <div className="grid grid-cols-2 gap-3">
        <select
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          className="h-8 border border-border bg-background px-2 text-xs"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Input placeholder="Code (e.g. gemini_free)" value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Unit (requests, tokens, pages)" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={mut.isPending}>
          {mut.isPending ? <LoadingState variant="inline" label="Creating..." /> : 'Create'}
        </Button>
      </div>
    </div>
  );
}

// ─── Pool Card ──────────────────────────────────────────────

function PoolCard({
  pool,
  providerName,
  isExpanded,
  onToggle,
}: {
  pool: CreditPool;
  providerName: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const deleteMut = useDeletePool();

  return (
    <div className="border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Coins className="h-4 w-4 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{pool.name}</span>
              <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 text-muted-foreground">
                {pool.code}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 ${
                pool.status === 'active' ? 'bg-success/10 text-success'
                  : pool.status === 'exhausted' ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {pool.status}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {providerName} · {pool.credit_unit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete pool "${pool.code}"?`)) deleteMut.mutate(pool.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
          <span className="text-xs text-muted-foreground">{isExpanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border p-3 space-y-4">
          <PoolQuotas poolId={pool.id} />
          <PoolUsageLogs poolId={pool.id} />
        </div>
      )}
    </div>
  );
}

// ─── Quotas section ─────────────────────────────────────────

function PoolQuotas({ poolId }: { poolId: string }) {
  const quotasQuery = useCreditQuotas(poolId);
  const createMut = useCreateQuota();
  const deleteMut = useDeleteQuota();
  const [showAdd, setShowAdd] = useState(false);
  const [windowType, setWindowType] = useState('day');
  const [maxCredits, setMaxCredits] = useState('');

  const quotas = quotasQuery.data ?? [];

  function handleAdd() {
    const max = parseInt(maxCredits, 10);
    if (!max || max <= 0) { toast.error('Max credits must be > 0'); return; }

    const now = new Date();
    const windowEnd = new Date(now);
    switch (windowType) {
      case 'minute': windowEnd.setMinutes(windowEnd.getMinutes() + 1); break;
      case 'hour': windowEnd.setHours(windowEnd.getHours() + 1); break;
      case 'day': windowEnd.setDate(windowEnd.getDate() + 1); break;
      case 'month': windowEnd.setMonth(windowEnd.getMonth() + 1); break;
    }

    createMut.mutate(
      { pool_id: poolId, window_type: windowType, max_credits: max, window_end: windowEnd.toISOString() },
      { onSuccess: () => { setShowAdd(false); setMaxCredits(''); } },
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> Quota Windows
        </p>
        <Button variant="ghost" size="sm" onClick={() => setShowAdd(!showAdd)} className="text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>

      {quotasQuery.isLoading && <LoadingState variant="skeleton" count={2} layout="list" itemClassName="h-10 w-full" />}

      {quotas.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground">No quota windows configured.</p>
      )}

      {quotas.map((q: CreditPoolQuota) => {
        const pct = q.max_credits > 0 ? Math.round((q.used_credits / q.max_credits) * 100) : 0;
        return (
          <div key={q.id} className="flex items-center justify-between py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground w-12">{q.window_type}</span>
              <span className="text-foreground">{q.used_credits}/{q.max_credits}</span>
              <span className={`text-[10px] px-1 ${pct >= 90 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {pct}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                resets {formatDateTime(q.window_end)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMut.mutate(q.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}

      {showAdd && (
        <div className="flex items-center gap-2 mt-2">
          <select
            value={windowType}
            onChange={(e) => setWindowType(e.target.value)}
            className="h-7 border border-border bg-background px-2 text-xs"
          >
            <option value="minute">minute</option>
            <option value="hour">hour</option>
            <option value="day">day</option>
            <option value="month">month</option>
          </select>
          <Input
            placeholder="Max credits"
            type="number"
            value={maxCredits}
            onChange={(e) => setMaxCredits(e.target.value)}
            className="w-28"
          />
          <Button size="sm" onClick={handleAdd} disabled={createMut.isPending}>Add</Button>
          <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

// ─── Usage logs section ─────────────────────────────────────

function PoolUsageLogs({ poolId }: { poolId: string }) {
  const usageQuery = useCreditUsage({ poolId, limit: 20 });
  const logs = usageQuery.data ?? [];

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1 mb-2">
        <BarChart3 className="h-3 w-3" /> Recent Usage (last 20)
      </p>

      {usageQuery.isLoading && <LoadingState variant="skeleton" count={3} layout="list" itemClassName="h-8 w-full" />}

      {logs.length === 0 && (
        <p className="text-xs text-muted-foreground">No usage recorded yet.</p>
      )}

      {logs.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {logs.map((log: CreditUsageLog) => (
            <div key={log.id} className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">{log.tool_code}</span>
                <span className="text-foreground">-{log.credits_used}</span>
                <span className={`text-[10px] px-1 ${
                  log.status === 'success' ? 'text-success'
                    : log.status === 'refunded' ? 'text-warning'
                      : 'text-destructive'
                }`}>
                  {log.status}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatDateTime(log.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}