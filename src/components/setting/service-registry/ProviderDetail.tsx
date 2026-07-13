// ============================================================
// ProviderDetail — Main content panel for a provider
// ============================================================

import { useState } from 'react';
import { ChevronDown, ChevronRight, Database, Plus, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  useServiceProviders,
  useServiceProfiles,
  useCreateProfile,
  useDeleteProfile,
  useToolBindingsByProfile,
} from '@/api/service-registry';
import type { ServiceProfile, ServiceProvider } from '@/lib/service-registry/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';

import CredentialCards from './CredentialCards';
import BindingManager from './BindingManager';

interface Props {
  providerCode: string;
}

export default function ProviderDetail({ providerCode }: Props) {
  const providersQuery = useServiceProviders();
  const provider = providersQuery.data?.find((p) => p.code === providerCode);

  if (providersQuery.isLoading) {
    return <LoadingState variant="skeleton" count={3} layout="list" itemClassName="h-20 w-full" />;
  }
  if (providersQuery.isError) {
    return <ErrorState message="Không load được providers" onRetry={() => providersQuery.refetch()} />;
  }
  if (!provider) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Provider "{providerCode}" chưa seed trong DB.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Chạy SQL migration trước.
        </p>
      </div>
    );
  }

  return <ProviderContent provider={provider} />;
}

function ProviderContent({ provider }: { provider: ServiceProvider }) {
  const profilesQuery = useServiceProfiles(provider.id);
  const createMut = useCreateProfile();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createMut.mutateAsync({
        provider_id: provider.id,
        name: newName.trim(),
        settings_json: {
          keySelectionStrategy: 'priority',
          defaultTimeout: 30000,
          cooldownDuration: 60000,
        },
      });
      toast.success(`Tạo pool "${newName.trim()}"`);
      setNewName('');
      setShowCreate(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tạo pool fail');
    }
  }

  return (
    <div className="space-y-6">
      {/* Provider header */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">{provider.name}</h1>
        {provider.description && (
          <p className="mt-1 text-sm text-muted-foreground">{provider.description}</p>
        )}
      </div>

      {/* Profiles */}
      {profilesQuery.isLoading && (
        <LoadingState variant="skeleton" count={2} layout="list" itemClassName="h-32 w-full" />
      )}
      {profilesQuery.isError && (
        <ErrorState message="Không load được pools" onRetry={() => profilesQuery.refetch()} />
      )}

      {profilesQuery.data?.map((profile) => (
        <PoolSection key={profile.id} profile={profile} providerCode={provider.code} />
      ))}

      {profilesQuery.data && profilesQuery.data.length === 0 && !showCreate && (
        <EmptyState
          icon={Database}
          title="Chưa có pool nào"
          description="Tạo pool đầu tiên để bắt đầu quản lý credentials cho provider này."
          action={
            <Button onClick={() => setShowCreate(true)} className="gap-1">
              <Plus className="h-4 w-4" />
              Tạo Pool
            </Button>
          }
        />
      )}

      {/* Create pool */}
      {showCreate && (
        <div className="rounded border border-border bg-muted/20 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Tạo pool mới</p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="VD: Default Pool, Backup Pool..."
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? 'Đang tạo...' : 'Tạo'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Huỷ
            </Button>
          </div>
        </div>
      )}

      {/* Add pool button when pools exist */}
      {profilesQuery.data && profilesQuery.data.length > 0 && !showCreate && (
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Thêm pool
        </Button>
      )}
    </div>
  );
}

function PoolSection({ profile, providerCode }: { profile: ServiceProfile; providerCode: string }) {
  const [expanded, setExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const deleteMut = useDeleteProfile();
  const bindingsQuery = useToolBindingsByProfile(profile.id);

  const bindings = bindingsQuery.data ?? [];
  const linkedTools = bindings.map((b) => b.tool_code).filter((v, i, a) => a.indexOf(v) === i);
  const strategy = profile.settings_json?.keySelectionStrategy ?? 'priority';

  async function handleDelete() {
    if (!confirm(`Xoá pool "${profile.name}"?\nSẽ xoá toàn bộ credentials và bindings bên trong.`)) return;
    try {
      await deleteMut.mutateAsync(profile.id);
      toast.success(`Đã xoá pool "${profile.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xoá fail');
    }
  }

  return (
    <div className="rounded border border-border">
      {/* Pool header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{profile.name}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {strategy}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] ${profile.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
              {profile.status}
            </span>
          </div>
          {linkedTools.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Used by: {linkedTools.join(' · ')}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-destructive"
          onClick={handleDelete}
          disabled={deleteMut.isPending}
        >
          Xoá
        </Button>
      </div>

      {/* Pool settings (collapse) */}
      {showSettings && (
        <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-foreground">Pool Settings</p>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-muted-foreground">Strategy</label>
              <p className="font-mono text-foreground">{strategy}</p>
            </div>
            <div>
              <label className="text-muted-foreground">Timeout</label>
              <p className="font-mono text-foreground">{profile.settings_json?.defaultTimeout ?? 30000}ms</p>
            </div>
            <div>
              <label className="text-muted-foreground">Cooldown</label>
              <p className="font-mono text-foreground">{profile.settings_json?.cooldownDuration ?? 60000}ms</p>
            </div>
          </div>
          <BindingManager profileId={profile.id} bindings={bindings} />
        </div>
      )}

      {/* Credentials */}
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <CredentialCards profileId={profile.id} providerCode={providerCode} />
        </div>
      )}
    </div>
  );
}