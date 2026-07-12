import { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Plus,
  Save,
  Trash2,
  Wifi,
  ExternalLink,
  FileArchive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  useSettingQuery,
  useUpdateSettingMutation,
  type CompressionLevel,
  type IlovepdfKeyEntry,
} from '@/api/settingsApi';
import {
  testKey,
  clearExhaustedKeys,
  getKeyPoolStatus,
} from '@/lib/library/pdf-compress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState, EmptyState } from '@/components/shared';

interface DraftKey {
  rid: string;
  name: string;
  public_key: string;
  secret_key: string;
  showSecret: boolean;
  /** Kết quả test connection gần nhất — null nếu chưa test */
  testResult: 'pass' | 'fail' | null;
  testing: boolean;
}

function newRid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function draftFrom(entry: IlovepdfKeyEntry): DraftKey {
  return {
    rid: newRid(),
    name: entry.name ?? '',
    public_key: entry.public_key,
    secret_key: entry.secret_key ?? '',
    showSecret: false,
    testResult: null,
    testing: false,
  };
}

export default function CompressConfigTab() {
  const query = useSettingQuery('compress_config');
  const update = useUpdateSettingMutation('compress_config');

  const [drafts, setDrafts] = useState<DraftKey[]>([]);
  const [level, setLevel] = useState<CompressionLevel>('recommended');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (query.data) {
      setDrafts((query.data.keys ?? []).map(draftFrom));
      setLevel(query.data.compression_level ?? 'recommended');
      setDirty(false);
    } else if (query.data === null && !query.isLoading) {
      setDrafts([]);
      setLevel('recommended');
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

  const isEmpty = drafts.length === 0;

  function patchDraft(rid: string, patch: Partial<DraftKey>) {
    setDrafts((prev) => prev.map((d) => (d.rid === rid ? { ...d, ...patch } : d)));
    setDirty(true);
  }

  function addKey() {
    setDrafts((prev) => [
      ...prev,
      {
        rid: newRid(),
        name: '',
        public_key: '',
        secret_key: '',
        showSecret: false,
        testResult: null,
        testing: false,
      },
    ]);
    setDirty(true);
  }

  function removeKey(rid: string) {
    setDrafts((prev) => prev.filter((d) => d.rid !== rid));
    setDirty(true);
  }

  async function handleSave() {
    const keys: IlovepdfKeyEntry[] = drafts
      .map((d) => ({
        name: d.name.trim(),
        public_key: d.public_key.trim(),
        secret_key: d.secret_key.trim() || undefined,
      }))
      .filter((k) => k.public_key.length > 0);

    if (keys.length === 0) {
      toast.error('Cần ít nhất 1 iLovePDF public key');
      return;
    }

    try {
      await update.mutateAsync({ keys, compression_level: level });
      toast.success(`Đã lưu ${keys.length} key`);
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save fail');
    }
  }

  async function handleTest(rid: string) {
    const d = drafts.find((x) => x.rid === rid);
    if (!d || !d.public_key.trim()) {
      toast.error('Nhập Public Key trước khi test');
      return;
    }
    patchDraft(rid, { testing: true, testResult: null });
    try {
      const ok = await testKey(d.public_key.trim());
      patchDraft(rid, { testing: false, testResult: ok ? 'pass' : 'fail' });
      if (ok) toast.success(`Key #${drafts.indexOf(d) + 1} OK`);
      else toast.error(`Key #${drafts.indexOf(d) + 1} fail — check public key`);
    } catch (err) {
      patchDraft(rid, { testing: false, testResult: 'fail' });
      toast.error(err instanceof Error ? err.message : 'Test fail');
    }
  }

  function handleResetExhausted() {
    clearExhaustedKeys();
    toast.success('Đã reset danh sách key exhausted local');
    // Force re-render để status badge refresh
    setDrafts((prev) => [...prev]);
  }

  // Snapshot key pool status cho badge (dùng saved data, không phải draft)
  const poolStatus = query.data
    ? getKeyPoolStatus(query.data)
    : [];
  const exhaustedCount = poolStatus.filter((s) => s.status === 'exhausted').length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">iLovePDF Compress</h3>
          <p className="text-xs text-muted-foreground">
            Free tier 2,500 credits/tháng per key (compress = 1 credit/file). Thêm nhiều key để fail-over khi 1 key hết quota.
          </p>
        </div>
        <Button
          onClick={addKey}
          variant="outline"
          size="sm"
          className="shrink-0 gap-1"
        >
          <Plus className="h-4 w-4" />
          Thêm key
        </Button>
      </div>

      {exhaustedCount > 0 && (
        <div className="flex items-center justify-between border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <span>
            {exhaustedCount}/{poolStatus.length} key đã dùng hết credit tháng này (session).
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetExhausted}
            className="gap-1"
            title="Xoá state exhausted local. Chỉ dùng khi credit thực sự đã reset."
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </Button>
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          compact
          icon={FileArchive}
          title="Chưa có key nào"
          description="Thêm ít nhất 1 iLovePDF public key. Đăng ký tại developer.ilovepdf.com."
          action={
            <Button onClick={addKey} className="gap-1">
              <Plus className="h-4 w-4" />
              Thêm key đầu tiên
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {drafts.map((d, idx) => {
            const savedStatus = poolStatus[idx];
            const isExhausted = savedStatus?.status === 'exhausted';
            return (
              <div
                key={d.rid}
                className="space-y-2 border border-border bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {d.name.trim() || `Key #${idx + 1}`}
                    </span>
                    {isExhausted ? (
                      <span className="flex items-center gap-1 text-warning">
                        <AlertCircle className="h-3 w-3" />
                        exhausted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        active
                      </span>
                    )}
                    {d.testResult === 'pass' && (
                      <span className="text-success">tested [pass]</span>
                    )}
                    {d.testResult === 'fail' && (
                      <span className="text-destructive">tested [fail]</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeKey(d.rid)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Tên</label>
                    <Input
                      type="text"
                      value={d.name}
                      onChange={(e) => patchDraft(d.rid, { name: e.target.value })}
                      placeholder="VD: Account công ty"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Public Key</label>
                    <Input
                      type="text"
                      value={d.public_key}
                      onChange={(e) => patchDraft(d.rid, { public_key: e.target.value, testResult: null })}
                      placeholder="project_public_..."
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Secret Key <span className="text-muted-foreground/60">(optional)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type={d.showSecret ? 'text' : 'password'}
                        value={d.secret_key}
                        onChange={(e) => patchDraft(d.rid, { secret_key: e.target.value })}
                        placeholder="secret_key_..."
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => patchDraft(d.rid, { showSecret: !d.showSecret })}
                      >
                        {d.showSecret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(d.rid)}
                    disabled={d.testing || !d.public_key.trim()}
                    className="gap-1"
                  >
                    <Wifi className="h-3 w-3" />
                    {d.testing ? 'Đang test...' : 'Test key này'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          Compression Level (áp cho mọi key)
        </label>
        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value as CompressionLevel);
            setDirty(true);
          }}
          className="w-full border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
        >
          <option value="low">low — giữ chất lượng, giảm ~10-30%</option>
          <option value="recommended">
            recommended — default, giảm ~50-70% (sweet spot)
          </option>
          <option value="extreme">
            extreme — aggressive, giảm ~70-85% (có thể mờ ảnh)
          </option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={!dirty || update.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {update.isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
        {dirty && <span className="text-xs text-warning">Có thay đổi chưa lưu</span>}
      </div>

      <details className="border border-border bg-muted/30 p-3 text-xs">
        <summary className="cursor-pointer text-foreground">
          Hướng dẫn setup + cơ chế fail-over
        </summary>
        <ol className="mt-2 space-y-1 pl-4 text-muted-foreground list-decimal">
          <li>
            Đăng ký tài khoản Developer tại{' '}
            <a
              href="https://developer.ilovepdf.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              developer.ilovepdf.com
            </a>{' '}
            (mỗi email 1 account, mỗi account 2,500 credit/tháng)
          </li>
          <li>Dashboard → Projects → tạo project → copy Public + Secret key</li>
          <li>Click "Thêm key" ở trên, paste 2 key → Save → Test key này</li>
          <li>
            Muốn nhiều credit hơn: đăng ký thêm email → tạo account thứ 2 → thêm key thứ 2 vào đây. Fail-over tự chuyển khi 1 key hết.
          </li>
        </ol>
        <p className="mt-3 text-muted-foreground">
          <strong className="text-foreground">Fail-over</strong>: khi 1 key trả 429 (hết credit), key đó bị mark exhausted trong localStorage kèm mốc tháng hiện tại. Request kế tiếp tự chuyển sang key khác. Sang tháng mới, exhausted state auto-clear.
        </p>
        <a
          href="https://developer.ilovepdf.com/docs"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
        >
          Xem API docs <ExternalLink className="h-3 w-3" />
        </a>
      </details>
    </div>
  );
}