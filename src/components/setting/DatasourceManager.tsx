// ============================================================
// DatasourceManager — CRUD admin UI for core.datasources
// ============================================================

import { useState } from 'react';
import { Database, Edit, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import { useDatasources } from '@/lib/core-sdk';
import type {
  Datasource,
  DatasourceDriver,
  EntityStatus,
} from '@/lib/core-sdk/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';

// ─── Mutations (inline, simple enough) ──────────────────────

function useCreateDatasource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      code: string;
      name: string;
      driver: DatasourceDriver;
      connection_json: Record<string, string>;
    }) => {
      const { data, error } = await authClient
        .from('datasources')
        .insert(input)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'datasources'] });
      toast.success('Datasource created');
    },
  });
}

function useUpdateDatasource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<Datasource>) => {
      const { id, ...rest } = input;
      const { error } = await authClient
        .from('datasources')
        .update(rest)
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'datasources'] });
      toast.success('Datasource updated');
    },
  });
}

function useDeleteDatasource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient
        .from('datasources')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'datasources'] });
      toast.success('Datasource deleted');
    },
  });
}

// ─── Main component ─────────────────────────────────────────

export default function DatasourceManager() {
  const query = useDatasources();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (query.isLoading) {
    return <LoadingState variant="skeleton" count={3} layout="list" itemClassName="h-20 w-full" />;
  }
  if (query.isError) {
    return <ErrorState message="Load datasources fail" onRetry={() => query.refetch()} />;
  }

  const datasources = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Datasources</h2>
          <p className="text-xs text-muted-foreground">
            Registry of Supabase projects and backends.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {showCreate && (
        <CreateDatasourceForm
          onClose={() => setShowCreate(false)}
        />
      )}

      {datasources.length === 0 && !showCreate && (
        <EmptyState
          icon={Database}
          title="No datasources"
          description="Add your first Supabase project or backend."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Add datasource
            </Button>
          }
        />
      )}

      <div className="space-y-2">
        {datasources.map((ds) => (
          <DatasourceCard
            key={ds.id}
            datasource={ds}
            isEditing={editingId === ds.id}
            onEdit={() => setEditingId(ds.id)}
            onClose={() => setEditingId(null)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Create form ────────────────────────────────────────────

function CreateDatasourceForm({ onClose }: { onClose: () => void }) {
  const mut = useCreateDatasource();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [driver, setDriver] = useState<DatasourceDriver>('supabase');
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  function handleSubmit() {
    if (!code.trim() || !name.trim()) {
      toast.error('Code and name are required');
      return;
    }

    const connection_json: Record<string, string> =
      driver === 'supabase'
        ? { url: url.trim(), anon_key: anonKey.trim() }
        : driver === 'mockapi'
          ? { base_url: baseUrl.trim() }
          : {};

    mut.mutate({ code: code.trim(), name: name.trim(), driver, connection_json }, {
      onSuccess: () => onClose(),
    });
  }

  return (
    <div className="space-y-3 border border-border p-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="code (e.g. library)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Input
          placeholder="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        {(['supabase', 'mockapi', 'none'] as DatasourceDriver[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDriver(d)}
            className={`px-3 py-1 text-xs border ${
              driver === d
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {driver === 'supabase' && (
        <div className="space-y-2">
          <Input
            placeholder="Supabase URL (https://xxx.supabase.co)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Input
            placeholder="Anon key"
            type="password"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
          />
        </div>
      )}

      {driver === 'mockapi' && (
        <Input
          placeholder="MockAPI base URL"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={mut.isPending}>
          {mut.isPending ? <LoadingState variant="inline" label="Creating..." /> : 'Create'}
        </Button>
      </div>
    </div>
  );
}

// ─── Datasource card ────────────────────────────────────────

function DatasourceCard({
  datasource,
  isEditing,
  onEdit,
  onClose,
}: {
  datasource: Datasource;
  isEditing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const updateMut = useUpdateDatasource();
  const deleteMut = useDeleteDatasource();

  if (isEditing) {
    return (
      <EditDatasourceForm
        datasource={datasource}
        onClose={onClose}
      />
    );
  }

  const conn = datasource.connection_json as Record<string, string>;
  const hasConnection = datasource.driver === 'supabase'
    ? Boolean(conn.url && conn.anon_key)
    : datasource.driver === 'mockapi'
      ? Boolean(conn.base_url)
      : true;

  return (
    <div className="flex items-center justify-between border border-border p-3">
      <div className="flex items-center gap-3">
        <Database className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{datasource.name}</span>
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5">
              {datasource.code}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 ${
              datasource.driver === 'supabase'
                ? 'bg-primary/10 text-primary'
                : datasource.driver === 'mockapi'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {datasource.driver}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {hasConnection
              ? datasource.driver === 'supabase'
                ? conn.url
                : datasource.driver === 'mockapi'
                  ? conn.base_url
                  : 'No connection needed'
              : 'Connection not configured'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const newStatus: EntityStatus = datasource.status === 'active' ? 'disabled' : 'active';
            updateMut.mutate({ id: datasource.id, status: newStatus });
          }}
          title={datasource.status === 'active' ? 'Disable' : 'Enable'}
        >
          {datasource.status === 'active'
            ? <Power className="h-3.5 w-3.5 text-success" />
            : <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </Button>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm(`Delete datasource "${datasource.code}"? Tools using it will break.`)) {
              deleteMut.mutate(datasource.id);
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ─── Edit form ──────────────────────────────────────────────

function EditDatasourceForm({
  datasource,
  onClose,
}: {
  datasource: Datasource;
  onClose: () => void;
}) {
  const mut = useUpdateDatasource();
  const conn = datasource.connection_json as Record<string, string>;

  const [name, setName] = useState(datasource.name);
  const [url, setUrl] = useState(conn.url ?? '');
  const [anonKey, setAnonKey] = useState(conn.anon_key ?? '');
  const [baseUrl, setBaseUrl] = useState(conn.base_url ?? '');

  function handleSave() {
    const connection_json: Record<string, string> =
      datasource.driver === 'supabase'
        ? { url: url.trim(), anon_key: anonKey.trim() }
        : datasource.driver === 'mockapi'
          ? { base_url: baseUrl.trim() }
          : {};

    mut.mutate(
      { id: datasource.id, name: name.trim(), connection_json } as Parameters<typeof mut.mutate>[0],
      { onSuccess: () => onClose() },
    );
  }

  return (
    <div className="space-y-3 border border-primary/30 p-4">
      <Input
        placeholder="Display name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {datasource.driver === 'supabase' && (
        <div className="space-y-2">
          <Input
            placeholder="Supabase URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Input
            placeholder="Anon key"
            type="password"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
          />
        </div>
      )}

      {datasource.driver === 'mockapi' && (
        <Input
          placeholder="MockAPI base URL"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={mut.isPending}>
          {mut.isPending ? <LoadingState variant="inline" label="Saving..." /> : 'Save'}
        </Button>
      </div>
    </div>
  );
}