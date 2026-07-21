// ============================================================
// StoragePoolManager — Admin UI for cloud storage pool (prepare state)
// ============================================================
// Shows storage credentials with capacity/usage + file list.
// Currently a "prepare" view — no upload action yet (plugins handle upload).
// ============================================================

import { HardDrive, File, AlertCircle } from 'lucide-react';

import { useStorageFiles } from '@/lib/core-sdk';
import type { StorageFile } from '@/lib/core-sdk/storage';
import { useServiceProviders, useServiceProfiles, useServiceCredentials } from '@/api/service-registry';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';

// ─── Helpers ────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// ─── Main ───────────────────────────────────────────────────

export default function StoragePoolManager() {
  const providersQuery = useServiceProviders();
  const filesQuery = useStorageFiles({ status: 'active' });

  if (providersQuery.isLoading) {
    return <LoadingState variant="skeleton" count={3} layout="list" itemClassName="h-20 w-full" />;
  }
  if (providersQuery.isError) {
    return <ErrorState message="Load providers fail" onRetry={() => providersQuery.refetch()} />;
  }

  // Find storage providers (category = 'storage')
  const storageProviders = (providersQuery.data ?? []).filter((p) => p.category === 'storage');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-foreground">Storage Pool</h2>
        <p className="text-xs text-muted-foreground">
          Cloud storage accounts pooled together. Files distributed by least-used strategy.
        </p>
      </div>

      {/* Storage credentials overview */}
      {storageProviders.length === 0 ? (
        <EmptyState
          icon={HardDrive}
          title="No storage provider"
          description="Add a storage provider (e.g. Google Drive) in the service registry first, then add credentials with storage capacity."
        />
      ) : (
        storageProviders.map((provider) => (
          <StorageProviderSection key={provider.id} providerId={provider.id} providerName={provider.name} />
        ))
      )}

      {/* File index */}
      <div>
        <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
          <File className="h-3 w-3" /> File Index
        </p>
        <FileList query={filesQuery} />
      </div>
    </div>
  );
}

// ─── Storage Provider Section ───────────────────────────────

function StorageProviderSection({ providerId, providerName }: { providerId: string; providerName: string }) {
  const profilesQuery = useServiceProfiles(providerId);
  const profiles = profilesQuery.data ?? [];

  if (profilesQuery.isLoading) {
    return <LoadingState variant="skeleton" count={1} layout="list" itemClassName="h-16 w-full" />;
  }

  if (profiles.length === 0) {
    return (
      <div className="border border-border p-3">
        <p className="text-xs text-muted-foreground">{providerName}: no profiles configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{providerName}</p>
      {profiles.map((profile) => (
        <StorageProfileCredentials key={profile.id} profileId={profile.id} profileName={profile.name} />
      ))}
    </div>
  );
}

// ─── Storage Credentials with capacity bars ─────────────────

function StorageProfileCredentials({ profileId, profileName }: { profileId: string; profileName: string }) {
  const credsQuery = useServiceCredentials(profileId);
  const credentials = credsQuery.data ?? [];

  // Filter only storage credentials (have storage_capacity_bytes)
  const storageCreds = credentials.filter((c) => c.credential_kind === 'storage' || c.credential_kind === 'oauth')
    .filter((c) => c.storage_capacity_bytes != null);

  if (credsQuery.isLoading) {
    return <LoadingState variant="skeleton" count={2} layout="list" itemClassName="h-12 w-full" />;
  }

  if (storageCreds.length === 0) {
    return (
      <div className="border border-border p-2">
        <p className="text-[11px] text-muted-foreground">
          {profileName}: no storage credentials. Add credentials with storage_capacity_bytes.
        </p>
      </div>
    );
  }

  const totalCapacity = storageCreds.reduce((sum, c) => sum + ((c.storage_capacity_bytes as number) ?? 0), 0);
  const totalUsed = storageCreds.reduce((sum, c) => sum + ((c.storage_used_bytes as number) ?? 0), 0);

  return (
    <div className="border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground">{profileName}</span>
        <span className="text-[10px] text-muted-foreground">
          {formatBytes(totalUsed)} / {formatBytes(totalCapacity)} ({storageCreds.length} accounts)
        </span>
      </div>

      {/* Overall bar */}
      <div className="h-2 bg-muted w-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            totalCapacity > 0 && totalUsed / totalCapacity > 0.9
              ? 'bg-destructive'
              : 'bg-primary'
          }`}
          style={{ width: totalCapacity > 0 ? `${Math.min(100, (totalUsed / totalCapacity) * 100)}%` : '0%' }}
        />
      </div>

      {/* Per-credential breakdown */}
      <div className="space-y-1">
        {storageCreds.map((cred) => {
          const capacity = (cred.storage_capacity_bytes as number) ?? 0;
          const used = (cred.storage_used_bytes as number) ?? 0;
          const pct = capacity > 0 ? Math.round((used / capacity) * 100) : 0;

          return (
            <div key={cred.id} className="flex items-center gap-2 text-[11px]">
              <HardDrive className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate flex-1">{cred.identifier}</span>
              <span className={`${pct >= 90 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {formatBytes(used)}/{formatBytes(capacity)}
              </span>
              <span className={`w-8 text-right ${pct >= 90 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {pct}%
              </span>
              <span className={`text-[10px] px-1 py-0.5 ${
                cred.status === 'active' ? 'bg-success/10 text-success'
                  : cred.status === 'full' ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {cred.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── File list ──────────────────────────────────────────────

function FileList({ query }: { query: ReturnType<typeof useStorageFiles> }) {
  if (query.isLoading) {
    return <LoadingState variant="skeleton" count={4} layout="list" itemClassName="h-10 w-full" />;
  }
  if (query.isError) {
    return <ErrorState compact message="Load files fail" onRetry={() => query.refetch()} />;
  }

  const files = query.data ?? [];

  if (files.length === 0) {
    return (
      <div className="border border-border p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>No files in storage pool yet. Files appear when plugins upload via core-sdk.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border divide-y divide-border max-h-64 overflow-y-auto">
      {files.map((file: StorageFile) => (
        <div key={file.id} className="flex items-center justify-between px-3 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-foreground truncate">{file.original_name}</span>
            {file.tool_code && (
              <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 text-muted-foreground shrink-0">
                {file.tool_code}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-muted-foreground">{formatBytes(file.size_bytes)}</span>
            <span className="text-[10px] text-muted-foreground">{formatDateTime(file.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}