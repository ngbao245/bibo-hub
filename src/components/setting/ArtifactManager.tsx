// ============================================================
// ArtifactManager — Admin UI for core.artifacts
// ============================================================
// List, filter, view, create artifacts (SQL migrations, edge functions).
// Code content displayed in a textarea (no heavy editor dependency).
// ============================================================

// ─── Helpers ────────────────────────────────────────────────

/** Format ISO timestamp to "DD/MM/YYYY HH:mm" */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

import { useState } from 'react';
import {
  Code2,
  Copy,
  Database,
  FileCode,
  Filter,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';

import {
  useArtifacts,
  useArtifact,
  useCreateArtifact,
  useUpdateArtifact,
  useDeleteArtifact,
  useDatasources,
} from '@/lib/core-sdk';
import type {
  Artifact,
  ArtifactKind,
  ArtifactStatus,
  CreateArtifactInput,
} from '@/lib/core-sdk/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';

// ─── Constants ──────────────────────────────────────────────

const KIND_OPTIONS: ArtifactKind[] = ['migration', 'edge_function', 'seed', 'script', 'shared'];
const STATUS_OPTIONS: ArtifactStatus[] = ['latest', 'deprecated', 'draft'];

const KIND_LABELS: Record<ArtifactKind, string> = {
  migration: 'Migration',
  edge_function: 'Edge Function',
  seed: 'Seed',
  script: 'Script',
  shared: 'Shared',
};

// ─── Main component ─────────────────────────────────────────

export default function ArtifactManager() {
  const [filterDs, setFilterDs] = useState<string>('');
  const [filterKind, setFilterKind] = useState<ArtifactKind | ''>('');
  const [filterTime, setFilterTime] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const datasourcesQuery = useDatasources();
  const artifactsQuery = useArtifacts({
    datasourceCode: filterDs || undefined,
    kind: filterKind || undefined,
    status: 'latest',
  });

  const datasources = datasourcesQuery.data ?? [];
  const allArtifacts = artifactsQuery.data ?? [];

  // Client-side time filter
  const timeFiltered = filterTime
    ? allArtifacts.filter((a) => {
        const ts = new Date(a.updated_at).getTime();
        const now = Date.now();
        switch (filterTime) {
          case '24h': return now - ts <= 24 * 60 * 60 * 1000;
          case '7d': return now - ts <= 7 * 24 * 60 * 60 * 1000;
          case '30d': return now - ts <= 30 * 24 * 60 * 60 * 1000;
          default: return true;
        }
      })
    : allArtifacts;

  // Show only latest version per (datasource_code, name)
  const artifacts = timeFiltered.filter((a, idx) =>
    !timeFiltered.slice(0, idx).some(
      (prev) => prev.datasource_code === a.datasource_code && prev.name === a.name
    )
  );

  if (artifactsQuery.isLoading) {
    return <LoadingState variant="skeleton" count={4} layout="list" itemClassName="h-16 w-full" />;
  }
  if (artifactsQuery.isError) {
    return <ErrorState message="Load artifacts fail" onRetry={() => artifactsQuery.refetch()} />;
  }

  const viewingArtifact = viewingId
    ? allArtifacts.find((a) => a.id === viewingId) ?? null
    : null;

  if (viewingArtifact) {
    return (
      <ArtifactDetailView
        artifact={viewingArtifact}
        onBack={() => setViewingId(null)}
        onViewVersion={(id) => setViewingId(id)}
      />
    );
  }

  // viewingId set but artifact not in current query (old version / deprecated)
  if (viewingId && !viewingArtifact) {
    return (
      <ArtifactDetailViewById
        id={viewingId}
        onBack={() => setViewingId(null)}
        onViewVersion={(id) => setViewingId(id)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Artifacts</h2>
          <p className="text-xs text-muted-foreground">
            SQL migrations, edge functions, scripts stored centrally.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={filterDs}
          onChange={(e) => setFilterDs(e.target.value)}
          className="h-7 border border-border bg-background px-2 text-xs text-foreground"
        >
          <option value="">All projects</option>
          {datasources.map((ds) => (
            <option key={ds.code} value={ds.code}>{ds.name}</option>
          ))}
        </select>
        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value as ArtifactKind | '')}
          className="h-7 border border-border bg-background px-2 text-xs text-foreground"
        >
          <option value="">All kinds</option>
          {KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </select>
        <select
          value={filterTime}
          onChange={(e) => setFilterTime(e.target.value)}
          className="h-7 border border-border bg-background px-2 text-xs text-foreground"
        >
          <option value="">All time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateArtifactForm
          datasources={datasources}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* List */}
      {artifacts.length === 0 && !showCreate && (
        <EmptyState
          icon={FileCode}
          title="No artifacts"
          description="Push your first migration or edge function."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Add artifact
            </Button>
          }
        />
      )}

      <div className="space-y-1">
        {artifacts.map((artifact) => (
          <ArtifactRow
            key={artifact.id}
            artifact={artifact}
            onClick={() => setViewingId(artifact.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Artifact row ───────────────────────────────────────────

function ArtifactRow({
  artifact,
  onClick,
}: {
  artifact: Artifact;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border border-border p-3 text-left hover:bg-muted/50 transition-colors"
    >
      {artifact.kind === 'migration' ? (
        <Database className="h-4 w-4 text-primary shrink-0" />
      ) : (
        <Code2 className="h-4 w-4 text-warning shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {artifact.name}
          </span>
          <span className="text-[10px] text-muted-foreground">v{artifact.version}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 text-muted-foreground">
            {artifact.datasource_code}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {KIND_LABELS[artifact.kind]}
          </span>
          {artifact.path && (
            <span className="text-[10px] text-muted-foreground truncate">
              {artifact.path}
            </span>
          )}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {formatDateTime(artifact.updated_at)}
      </span>
    </button>
  );
}

// ─── Detail view ────────────────────────────────────────────

function ArtifactDetailView({
  artifact,
  onBack,
  onViewVersion,
}: {
  artifact: Artifact;
  onBack: () => void;
  onViewVersion: (id: string) => void;
}) {
  const updateMut = useUpdateArtifact();
  const createMut = useCreateArtifact();
  const deleteMut = useDeleteArtifact();
  const [content, setContent] = useState(artifact.content);
  const [status, setStatus] = useState<ArtifactStatus>(artifact.status);
  const hasChanges = content !== artifact.content || status !== artifact.status;

  // Fetch all versions of this artifact (same datasource_code + name, including deprecated)
  const allVersionsQuery = useQuery({
    queryKey: ['core-sdk', 'artifacts', 'versions', artifact.datasource_code, artifact.name],
    queryFn: async (): Promise<Artifact[]> => {
      const { data, error } = await authClient
        .from('artifacts')
        .select('*')
        .eq('datasource_code', artifact.datasource_code)
        .eq('name', artifact.name)
        .order('version', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Artifact[];
    },
    staleTime: 30 * 1000,
  });
  const allVersions = allVersionsQuery.data ?? [];

  function handleSave() {
    if (content !== artifact.content) {
      // Content changed → create new version
      createMut.mutate(
        {
          datasource_code: artifact.datasource_code,
          kind: artifact.kind,
          name: artifact.name,
          path: artifact.path ?? undefined,
          version: artifact.version + 1,
          content,
          status: 'latest',
        },
        {
          onSuccess: () => {
            // Mark old version as deprecated
            updateMut.mutate({ id: artifact.id, status: 'deprecated' });
            toast.success(`Saved as v${artifact.version + 1}`);
          },
        },
      );
    } else if (status !== artifact.status) {
      // Only status changed → update in place
      updateMut.mutate(
        { id: artifact.id, status },
        { onSuccess: () => toast.success('Status updated') },
      );
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  }

  function handleDelete() {
    if (confirm(`Delete "${artifact.name}" v${artifact.version}?`)) {
      deleteMut.mutate(artifact.id, { onSuccess: () => onBack() });
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            &larr; Back to list
          </button>
          <h2 className="text-sm font-medium text-foreground">{artifact.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 text-muted-foreground">
              {artifact.datasource_code}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {KIND_LABELS[artifact.kind]}
            </span>
            <span className="text-[10px] text-muted-foreground">v{artifact.version}</span>
            {artifact.path && (
              <span className="text-[10px] text-muted-foreground">{artifact.path}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ArtifactStatus)}
            className="h-7 border border-border bg-background px-2 text-xs"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={handleCopy} title="Copy content">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Content editor */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
        className="w-full min-h-[400px] border border-border bg-card p-4 font-mono text-xs text-foreground resize-y focus:outline-none focus:border-primary"
      />

      {/* Actions */}
      {hasChanges && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setContent(artifact.content); setStatus(artifact.status); }}
          >
            Discard
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
            {updateMut.isPending
              ? <LoadingState variant="inline" label="Saving..." />
              : 'Save changes'}
          </Button>
        </div>
      )}

      {/* Version history */}
      {allVersions.length > 1 && (
        <div className="border border-border p-3">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
            Version History ({allVersions.length} versions)
          </p>
          <div className="space-y-1">
            {allVersions.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => { if (v.id !== artifact.id) onViewVersion(v.id); }}
                className={`flex w-full items-center justify-between px-2 py-1.5 text-xs transition-colors ${
                  v.id === artifact.id
                    ? 'bg-primary/10 text-primary cursor-default'
                    : 'text-muted-foreground hover:bg-muted cursor-pointer'
                }`}
              >
                <span>
                  v{v.version}
                  {v.id === artifact.id && ' (viewing)'}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 ${
                    v.status === 'latest' ? 'bg-success/10 text-success'
                      : v.status === 'deprecated' ? 'bg-warning/10 text-warning'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {v.status}
                  </span>
                  <span>{formatDateTime(v.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create form ────────────────────────────────────────────

function CreateArtifactForm({
  datasources,
  onClose,
}: {
  datasources: { code: string; name: string }[];
  onClose: () => void;
}) {
  const createMut = useCreateArtifact();
  const [datasourceCode, setDatasourceCode] = useState(datasources[0]?.code ?? '');
  const [kind, setKind] = useState<ArtifactKind>('migration');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [content, setContent] = useState('');

  function handleSubmit() {
    if (!datasourceCode || !name.trim() || !content.trim()) {
      toast.error('Datasource, name, and content are required');
      return;
    }

    const input: CreateArtifactInput = {
      datasource_code: datasourceCode,
      kind,
      name: name.trim(),
      path: path.trim() || undefined,
      content: content.trim(),
    };

    createMut.mutate(input, { onSuccess: () => onClose() });
  }

  return (
    <div className="space-y-3 border border-border p-4">
      <div className="grid grid-cols-3 gap-3">
        <select
          value={datasourceCode}
          onChange={(e) => setDatasourceCode(e.target.value)}
          className="h-8 border border-border bg-background px-2 text-xs"
        >
          {datasources.map((ds) => (
            <option key={ds.code} value={ds.code}>{ds.name}</option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ArtifactKind)}
          className="h-8 border border-border bg-background px-2 text-xs"
        >
          {KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </select>
        <Input
          placeholder="Name (e.g. books_schema)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {(kind === 'edge_function' || kind === 'shared') && (
        <Input
          placeholder="Path (e.g. functions/send-campaign/index.ts)"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={kind === 'migration' ? '-- SQL content...' : '// TypeScript content...'}
        spellCheck={false}
        className="w-full min-h-[200px] border border-border bg-card p-3 font-mono text-xs text-foreground resize-y focus:outline-none focus:border-primary"
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={createMut.isPending}>
          {createMut.isPending
            ? <LoadingState variant="inline" label="Creating..." />
            : 'Create'}
        </Button>
      </div>
    </div>
  );
}

// ─── Detail view by ID (for viewing old/deprecated versions) ─

function ArtifactDetailViewById({
  id,
  onBack,
  onViewVersion,
}: {
  id: string;
  onBack: () => void;
  onViewVersion: (id: string) => void;
}) {
  const query = useArtifact(id);

  if (query.isLoading) {
    return <LoadingState variant="skeleton" count={1} layout="list" itemClassName="h-64 w-full" />;
  }
  if (query.isError || !query.data) {
    return <ErrorState message="Artifact not found" onRetry={() => query.refetch()} />;
  }

  return (
    <ArtifactDetailView
      artifact={query.data}
      onBack={onBack}
      onViewVersion={onViewVersion}
    />
  );
}