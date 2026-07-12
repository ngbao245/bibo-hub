import { useEffect, useState } from 'react';
import { Save, Wifi, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import {
  useSettingQuery,
  useUpdateSettingMutation,
  type DriveBackupConfigValue,
} from '@/api/settingsApi';
import { testDriveConnection } from '@/lib/library/drive-backup';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState } from '@/components/shared';

export default function DriveBackupTab() {
  const query = useSettingQuery('drive_backup_config');
  const update = useUpdateSettingMutation('drive_backup_config');

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [folderId, setFolderId] = useState('');
  const [dirty, setDirty] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (query.data) {
      setName(query.data.name ?? '');
      setClientId(query.data.client_id ?? '');
      setClientSecret(query.data.client_secret ?? '');
      setRefreshToken(query.data.refresh_token ?? '');
      setFolderId(query.data.folder_id ?? '');
      setDirty(false);
    } else if (query.data === null && !query.isLoading) {
      setName('');
      setClientId('');
      setClientSecret('');
      setRefreshToken('');
      setFolderId('');
      setDirty(false);
    }
  }, [query.data, query.isLoading]);

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : 'Load fail'}
        onRetry={() => query.refetch()}
      />
    );
  }

  const isValid =
    clientId.trim() && clientSecret.trim() && refreshToken.trim() && folderId.trim();

  async function handleTest() {
    if (!isValid) return;
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await testDriveConnection({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        refresh_token: refreshToken.trim(),
        folder_id: folderId.trim(),
      });
      setTestResult(ok ? 'pass' : 'fail');
      if (ok) toast.success('Kết nối thành công');
      else toast.error('Không kết nối được — check credentials + folder ID');
    } catch (err) {
      setTestResult('fail');
      toast.error(err instanceof Error ? err.message : 'Test fail');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!isValid) return;
    const value: DriveBackupConfigValue = {
      name: name.trim(),
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      refresh_token: refreshToken.trim(),
      folder_id: folderId.trim(),
    };
    try {
      await update.mutateAsync(value);
      toast.success('Đã lưu Drive Backup config');
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save fail');
    }
  }

  function markDirty() {
    setDirty(true);
    setTestResult(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Google Drive Backup</h3>
        <p className="text-xs text-muted-foreground">
          Upload bản gốc PDF lên Google Drive khi thêm sách. Dùng OAuth2 personal account — config 1 lần, không cần login lại.
        </p>
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Tên config</label>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty(); }}
          placeholder="VD: Drive cá nhân"
          className="text-xs"
        />
      </div>

      {/* Client ID */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">OAuth2 Client ID</label>
        <Input
          value={clientId}
          onChange={(e) => { setClientId(e.target.value); markDirty(); }}
          placeholder="123456789.apps.googleusercontent.com"
          className="font-mono text-xs"
        />
      </div>

      {/* Client Secret */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">OAuth2 Client Secret</label>
        <div className="flex items-center gap-2">
          <Input
            type={showSecret ? 'text' : 'password'}
            value={clientSecret}
            onChange={(e) => { setClientSecret(e.target.value); markDirty(); }}
            placeholder="GOCSPX-..."
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Refresh Token */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Refresh Token</label>
        <div className="flex items-center gap-2">
          <Input
            type={showToken ? 'text' : 'password'}
            value={refreshToken}
            onChange={(e) => { setRefreshToken(e.target.value); markDirty(); }}
            placeholder="1//0a..."
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowToken(!showToken)}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Folder ID */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Google Drive Folder ID</label>
        <Input
          value={folderId}
          onChange={(e) => { setFolderId(e.target.value); markDirty(); }}
          placeholder="1A2B3C4D5E... (lấy từ URL folder)"
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          URL folder: drive.google.com/drive/folders/<span className="text-foreground">ID_NÀY</span>
        </p>
      </div>

      {/* Test + badge */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testing || !isValid}
          className="gap-1"
        >
          <Wifi className="h-3 w-3" />
          {testing ? 'Đang test...' : 'Test Connection'}
        </Button>
        {testResult === 'pass' && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            OK
          </span>
        )}
        {testResult === 'fail' && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            Fail
          </span>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={!dirty || !isValid || update.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {update.isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
        {dirty && <span className="text-xs text-warning">Có thay đổi chưa lưu</span>}
      </div>

      {/* Guide */}
      <details className="border border-border bg-muted/30 p-3 text-xs">
        <summary className="cursor-pointer text-foreground">
          Hướng dẫn lấy Refresh Token (1 lần)
        </summary>
        <ol className="mt-2 space-y-1 pl-4 text-muted-foreground list-decimal">
          <li>Google Cloud Console → APIs & Services → Credentials</li>
          <li>Create OAuth Client ID (Web application)</li>
          <li>Authorized redirect URIs: thêm <code className="text-foreground">https://developers.google.com/oauthplayground</code></li>
          <li>
            Mở{' '}
            <a
              href="https://developers.google.com/oauthplayground"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              OAuth Playground
            </a>
          </li>
          <li>Settings (gear icon) → tick "Use your own OAuth credentials" → paste Client ID + Secret</li>
          <li>Step 1: chọn scope <code className="text-foreground">https://www.googleapis.com/auth/drive.file</code> → Authorize</li>
          <li>Step 2: Exchange authorization code → copy <strong className="text-foreground">Refresh Token</strong></li>
          <li>Paste 3 giá trị (Client ID, Client Secret, Refresh Token) + Folder ID vào form trên → Save</li>
        </ol>
        <p className="mt-3 text-muted-foreground">
          <strong className="text-foreground">Lưu ý</strong>: Publish app (OAuth consent screen → In Production) để refresh token không expire sau 7 ngày.
        </p>
      </details>
    </div>
  );
}