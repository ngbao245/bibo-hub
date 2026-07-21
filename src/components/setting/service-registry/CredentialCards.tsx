// ============================================================
// CredentialCards — Grid 2-col compact cards + expand detail
// ============================================================

import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Plus, Trash2, Wifi } from 'lucide-react';
import { toast } from 'sonner';

import {
  useServiceCredentials,
  useCreateCredential,
  useUpdateCredential,
  useDeleteCredential,
} from '@/api/service-registry';
import type { ServiceCredential, CredentialStatus } from '@/lib/service-registry/types';
import { testCredentialConnection } from '@/lib/service-registry/test-connection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';

interface Props {
  profileId: string;
  providerCode: string;
}

export default function CredentialCards({ profileId, providerCode }: Props) {
  const query = useServiceCredentials(profileId);
  const createMut = useCreateCredential();
  const deleteMut = useDeleteCredential();
  const [showAdd, setShowAdd] = useState(false);

  if (query.isLoading) {
    return <LoadingState variant="skeleton" count={4} layout="grid" itemClassName="h-20 w-full" />;
  }
  if (query.isError) {
    return <ErrorState compact message="Load credentials fail" onRetry={() => query.refetch()} />;
  }

  const credentials = query.data ?? [];

  return (
    <div className="space-y-3">
      {credentials.length === 0 && !showAdd && (
        <EmptyState
          compact
          icon={KeyRound}
          title="Chưa có credential"
          description="Thêm API key hoặc account để bắt đầu."
          action={
            <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Thêm credential
            </Button>
          }
        />
      )}

      {/* Grid 2 cột — luôn hiện full detail */}
      {credentials.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {credentials.map((cred) => (
            <CredentialCard
              key={cred.id}
              credential={cred}
              providerCode={providerCode}
              profileId={profileId}
              onDelete={() => deleteMut.mutateAsync({ id: cred.id, profileId })}
            />
          ))}
        </div>
      )}

      {credentials.length > 0 && !showAdd && (
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Thêm credential
        </Button>
      )}

      {showAdd && (
        <AddCredentialForm
          profileId={profileId}
          providerCode={providerCode}
          priority={credentials.length}
          onCreated={() => setShowAdd(false)}
          onCancel={() => setShowAdd(false)}
          isPending={createMut.isPending}
          onCreate={createMut.mutateAsync}
        />
      )}
    </div>
  );
}

// ─── Compact Card ───────────────────────────────────────────

function CredentialCard({
  credential,
  providerCode,
  onDelete,
}: {
  credential: ServiceCredential;
  providerCode: string;
  profileId: string;
  onDelete: () => Promise<unknown>;
}) {
  const updateMut = useUpdateCredential();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await testCredentialConnection(providerCode, credential);
      setTestResult(ok ? 'pass' : 'fail');
      if (ok) {
        await updateMut.mutateAsync({ id: credential.id, last_success_at: new Date().toISOString() });
      } else {
        await updateMut.mutateAsync({ id: credential.id, last_error_at: new Date().toISOString(), last_error_message: 'Connection test failed' });
      }
      toast[ok ? 'success' : 'error'](ok ? 'OK' : 'Failed');
    } catch {
      setTestResult('fail');
      toast.error('Test error');
    } finally {
      setTesting(false);
    }
  }

  async function handleToggle() {
    const newStatus: CredentialStatus = credential.status === 'active' ? 'disabled' : 'active';
    try {
      await updateMut.mutateAsync({ id: credential.id, status: newStatus });
      toast.success(`${newStatus}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fail');
    }
  }

  async function handleDelete() {
    if (!confirm(`Xoá "${credential.name || credential.identifier}"?`)) return;
    try {
      await onDelete();
      toast.success('Đã xoá');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fail');
    }
  }

  // Signal color
  function getSignalColor(): string {
    if (credential.status === 'disabled') return 'bg-muted-foreground/40';
    if (credential.status === 'invalid' || credential.status === 'error' || credential.status === 'exhausted' || credential.status === 'cooldown') return 'bg-destructive';
    if (testResult === 'pass') return 'bg-success';
    if (testResult === 'fail') return 'bg-destructive';
    const lastSuccess = credential.last_success_at ? new Date(credential.last_success_at).getTime() : 0;
    const lastError = credential.last_error_at ? new Date(credential.last_error_at).getTime() : 0;
    if (lastSuccess > 0 && lastSuccess > lastError) return 'bg-success';
    if (lastError > 0 && lastError > lastSuccess) return 'bg-destructive';
    return 'bg-warning';
  }

  const secret = credential.secret_data_json;
  const secretDisplay = secret
    ? Object.entries(secret)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 20)}${String(v).length > 20 ? '...' : ''}`)
        .join('\n')
    : null;

  return (
    <div className="border border-border p-3 space-y-2">
      {/* Header: signal + name + status */}
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${getSignalColor()}`} />
        <span className="text-xs font-medium text-foreground truncate flex-1">
          {credential.name || credential.identifier}
        </span>
        <span className="text-[10px] text-muted-foreground">p:{credential.priority}</span>
        <span className={`text-[10px] px-1 py-0.5 ${
          credential.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
        }`}>
          {credential.status}
        </span>
      </div>

      {/* Identifier */}
      <p className="font-mono text-[11px] text-muted-foreground truncate">{credential.identifier}</p>

      {/* Secret */}
      {secret && (
        <div className="flex items-start gap-2">
          <pre className="flex-1 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground bg-background/50 p-1.5 overflow-hidden">
            {showSecret ? secretDisplay : '••••••••'}
          </pre>
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
      )}

      {/* Error */}
      {credential.last_error_message && (
        <p className="text-[10px] text-destructive truncate">
          {credential.last_error_message}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1">
        <Button variant="outline" size="sm" className="gap-1 text-xs h-6 px-2" onClick={handleTest} disabled={testing}>
          <Wifi className={`h-2.5 w-2.5 ${testResult === 'pass' ? 'text-success' : testResult === 'fail' ? 'text-destructive' : ''}`} />
          {testing ? '...' : 'Test'}
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-6 px-2" onClick={handleToggle} disabled={updateMut.isPending}>
          {credential.status === 'active' ? 'Disable' : 'Enable'}
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto text-xs h-6 px-1.5 text-destructive" onClick={handleDelete}>
          <Trash2 className="h-2.5 w-2.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Dynamic Add Form ───────────────────────────────────────

interface AddFormProps {
  profileId: string;
  providerCode: string;
  priority: number;
  onCreated: () => void;
  onCancel: () => void;
  isPending: boolean;
  onCreate: (input: {
    profile_id: string;
    name?: string;
    identifier: string;
    secret_data_json?: Record<string, unknown>;
    priority?: number;
  }) => Promise<unknown>;
}

function AddCredentialForm({ profileId, providerCode, priority, onCreated, onCancel, isPending, onCreate }: AddFormProps) {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const schema = getProviderSchema(providerCode);

  function updateField(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    const identifier = fields[schema.identifierField] ?? '';
    if (!identifier.trim()) {
      toast.error(`${schema.fields.find((f) => f.key === schema.identifierField)?.label ?? 'Identifier'} bắt buộc`);
      return;
    }

    const secretData: Record<string, unknown> = {};
    for (const f of schema.fields) {
      if (fields[f.key]?.trim()) {
        secretData[f.key] = fields[f.key].trim();
      }
    }

    try {
      await onCreate({
        profile_id: profileId,
        name: name.trim() || undefined,
        identifier: identifier.trim(),
        secret_data_json: Object.keys(secretData).length > 0 ? secretData : undefined,
        priority,
      });
      toast.success('Đã thêm credential');
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Thêm fail');
    }
  }

  return (
    <div className="border border-border bg-muted/10 p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">Thêm credential</p>

      <div className="space-y-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên gợi nhớ (optional)"
          className="text-sm"
        />

        {schema.fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{field.label}</label>
            <Input
              type={field.secret ? 'password' : 'text'}
              value={fields[field.key] ?? ''}
              onChange={(e) => updateField(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="font-mono text-sm"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}

// ─── Provider field schemas ─────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
}

interface ProviderSchema {
  identifierField: string;
  fields: FieldDef[];
}

function getProviderSchema(providerCode: string): ProviderSchema {
  switch (providerCode) {
    case 'gemini':
      return {
        identifierField: 'apiKey',
        fields: [
          { key: 'apiKey', label: 'API Key', placeholder: 'AIzaSy...', secret: true },
        ],
      };
    case 'ilovepdf':
      return {
        identifierField: 'public_key',
        fields: [
          { key: 'public_key', label: 'Public Key', placeholder: 'project_public_...' },
          { key: 'secret_key', label: 'Secret Key (optional)', placeholder: 'secret_key_...', secret: true },
        ],
      };
    case 'cloudconvert':
      return {
        identifierField: 'apiKey',
        fields: [
          { key: 'apiKey', label: 'API Key', placeholder: 'eyJ0eX...', secret: true },
        ],
      };
    case 'google_drive':
      return {
        identifierField: 'client_id',
        fields: [
          { key: 'client_id', label: 'OAuth2 Client ID', placeholder: '123456.apps.googleusercontent.com' },
          { key: 'client_secret', label: 'Client Secret', placeholder: 'GOCSPX-...', secret: true },
          { key: 'refresh_token', label: 'Refresh Token', placeholder: '1//0a...', secret: true },
          { key: 'folder_id', label: 'Drive Folder ID', placeholder: '1A2B3C4D...' },
        ],
      };
    case 'firebase':
      return {
        identifierField: 'projectId',
        fields: [
          { key: 'apiKey', label: 'API Key', placeholder: 'AIzaSy...', secret: true },
          { key: 'authDomain', label: 'Auth Domain', placeholder: 'xxx.firebaseapp.com' },
          { key: 'databaseURL', label: 'Database URL', placeholder: 'https://xxx.firebaseio.com' },
          { key: 'projectId', label: 'Project ID', placeholder: 'my-project' },
          { key: 'storageBucket', label: 'Storage Bucket', placeholder: 'xxx.appspot.com' },
          { key: 'messagingSenderId', label: 'Sender ID', placeholder: '123456' },
          { key: 'appId', label: 'App ID', placeholder: '1:123:web:abc', secret: true },
        ],
      };
    case 'metered_turn':
      return {
        identifierField: 'username',
        fields: [
          { key: 'username', label: 'Username', placeholder: 'turn-username' },
          { key: 'credential', label: 'Credential', placeholder: 'turn-credential', secret: true },
        ],
      };
    default:
      return {
        identifierField: 'key',
        fields: [
          { key: 'key', label: 'Key / Identifier', placeholder: '...' },
          { key: 'secret', label: 'Secret', placeholder: '...', secret: true },
        ],
      };
  }
}