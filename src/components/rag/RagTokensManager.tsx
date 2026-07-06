import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, ExternalLink, Loader2, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';

import { useSettings, useCreateSetting, useUpdateSetting } from '@/api/setting';
import { CONFIG_KEYS, EMPTY_SETTING, type Setting, type SettingInput } from '@/lib/setting';
import {
  encodeFieldSlots,
  encryptText,
  type FieldEntry,
} from '@/lib/cryptoFields';
import { useCryptoStore } from '@/stores/cryptoStore';
import { APP_SECRET } from '@/lib/appSecret';
import { cn } from '@/lib/cn';

import { loadRagTokens } from '@/lib/rag/rag-vault';
import { useRagStore } from '@/stores/ragStore';
import { tryBootstrapRag } from '@/lib/rag/auto-bootstrap';
import { RagVaultError } from '@/lib/rag/types';

// ============================================================
// RagTokensManager — UI dynamic slots cho Gemini API keys
// ============================================================
//
// Mount trong DialogContent, self-fetch + self-save. Không truyền data
// từ parent, chỉ báo dirty qua onDirtyChange.
//
// UI:
//   - Mặc định 1 slot (Key #1), nút "+ Add key" để thêm slot mới.
//   - Nút "-" trên slot lẻ để xoá (min 1 slot).
//   - Không có Groq input (feature đã bỏ).
//
// Storage: mỗi key encrypt thành entry `{k:"geminiApiKey"+i, e:1, v:ct}`,
// dồn vào config1 (JSON array). Backward compat với data cũ (format cứng
// 3 field cùng convention).
// ============================================================

const RAG_GROUP = 'RAG';
const TOKENS_TYPE = 'SettingInfor';

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

export default function RagTokensManager({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const settingsQuery = useSettings();
  const createMut = useCreateSetting();
  const updateMut = useUpdateSetting();
  const passphrase = useCryptoStore((s) => s.passphrase);

  // State: array key rỗng ban đầu → sẽ populate từ load hoặc default 1 slot.
  const [keys, setKeys] = useState<string[]>(['']);
  const [originalHash, setOriginalHash] = useState<string>(hashKeys(['']));
  const [show, setShow] = useState<Record<number, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<number, TestStatus>>({});
  const [loadingExisting, setLoadingExisting] = useState(false);

  const existingRecord = useMemo<Setting | undefined>(
    () =>
      settingsQuery.data?.find(
        (s) =>
          s.group.trim().toLowerCase() === RAG_GROUP.toLowerCase() &&
          s.type.trim().toLowerCase() === TOKENS_TYPE.toLowerCase(),
      ),
    [settingsQuery.data],
  );
  const loadedRecordIdRef = useRef<string | null>(null);

  // Load + decrypt tokens hiện có — CHỈ 1 LẦN khi record xuất hiện.
  // Dùng ref flag để không re-load mỗi khi TanStack Query refetch (window focus,
  // invalidate) — nếu không sẽ override state user đang edit.
  useEffect(() => {
    if (!existingRecord) return;
    // Skip nếu đã load cho record này (guard TanStack refetch, không set ref
    // ở đầu để tránh React 18 strict mode fire useEffect 2 lần cause stuck skeleton).
    const targetId = existingRecord.id;
    if (loadedRecordIdRef.current === targetId) return;

    let cancelled = false;
    setLoadingExisting(true);
    (async () => {
      try {
        const t = await loadRagTokens();
        if (cancelled) return;
        loadedRecordIdRef.current = targetId; // Set ref CHỈ khi thực sự load xong
        const loaded = t.geminiApiKeys.length > 0 ? t.geminiApiKeys : [''];
        setKeys(loaded);
        setOriginalHash(hashKeys(loaded));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof RagVaultError && err.code === 'decrypt_failed') {
          toast.error('Không decrypt được tokens hiện có', {
            description: 'Mở Crypto modal để nhập passphrase đúng.',
          });
        } else {
          toast.error('Lỗi load tokens', {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existingRecord]);

  // Báo dirty cho parent
  useEffect(() => {
    onDirtyChange?.(hashKeys(keys) !== originalHash);
  }, [keys, originalHash, onDirtyChange]);

  function setKeyAt(idx: number, value: string) {
    setKeys((prev) => prev.map((k, i) => (i === idx ? value : k)));
    setTestStatus((prev) => ({ ...prev, [idx]: 'idle' }));
  }

  function addKey() {
    setKeys((prev) => [...prev, '']);
  }

  function removeKey(idx: number) {
    setKeys((prev) => {
      if (prev.length <= 1) return prev; // giữ min 1 slot
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [''] : next;
    });
    setTestStatus((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    setShow((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }

  async function testKey(idx: number) {
    const k = keys[idx]?.trim() ?? '';
    if (!k) {
      toast.error('Chưa có key để test');
      return;
    }
    setTestStatus((prev) => ({ ...prev, [idx]: 'testing' }));
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${encodeURIComponent(k)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/gemini-embedding-001',
            content: { parts: [{ text: 'hello' }] },
            outputDimensionality: 768,
          }),
        },
      );
      if (res.ok) {
        setTestStatus((prev) => ({ ...prev, [idx]: 'ok' }));
        toast.success(`Key #${idx + 1} OK`);
      } else {
        setTestStatus((prev) => ({ ...prev, [idx]: 'fail' }));
        toast.error(`Key #${idx + 1} HTTP ${res.status}`);
      }
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [idx]: 'fail' }));
      toast.error('Test thất bại', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleSave() {
    const nonEmpty = keys.map((k) => k.trim()).filter((k) => k.length > 0);
    if (nonEmpty.length === 0) {
      toast.error('Cần ít nhất 1 Gemini key');
      return;
    }

    const passKey = passphrase.trim() || APP_SECRET;
    if (!passKey) {
      toast.error('Không có passphrase để encrypt');
      return;
    }

    try {
      const entries: FieldEntry[] = [];
      for (let i = 0; i < nonEmpty.length; i++) {
        const ct = await encryptText(nonEmpty[i], passKey);
        entries.push({ k: `geminiApiKey${i + 1}`, e: 1, v: ct });
      }

      const slots = encodeFieldSlots(entries);
      if (slots.length > CONFIG_KEYS.length) {
        toast.error(`Vượt ${CONFIG_KEYS.length} slot — quá dài`);
        return;
      }

      const slotMap = {} as Record<(typeof CONFIG_KEYS)[number], string>;
      for (const k of CONFIG_KEYS) slotMap[k] = '';
      slots.forEach((s, i) => {
        slotMap[CONFIG_KEYS[i]] = s;
      });

      const payload: SettingInput = {
        ...EMPTY_SETTING,
        description: `RAG Gemini keys (${nonEmpty.length} keys)`,
        group: RAG_GROUP,
        type: TOKENS_TYPE,
        ...slotMap,
      };

      if (existingRecord) {
        await updateMut.mutateAsync({ ...payload, id: existingRecord.id } as Setting);
      } else {
        await createMut.mutateAsync(payload);
      }

      // Compact keys state (bỏ slot rỗng sau save để consistent với data đã persist)
      const compacted = nonEmpty.length > 0 ? nonEmpty : [''];
      setKeys(compacted);
      setOriginalHash(hashKeys(compacted));
      toast.success('Đã lưu RAG tokens');

      await tryBootstrapRag();
    } catch (err) {
      toast.error('Lỗi lưu', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const dirty = hashKeys(keys) !== originalHash;
  const saving = createMut.isPending || updateMut.isPending;
  const geminiCount = keys.filter((k) => k.trim().length > 0).length;
  const storeStatus = useRagStore((s) => s.status);

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-border bg-background/40 p-3 text-xs text-muted-foreground">
        <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Key pool rotation
        </p>
        <p>
          Tạo nhiều Gemini API key từ các Google account riêng để tăng quota
          (15 RPM × 1500 RPD mỗi key). Bấm{' '}
          <strong className="text-foreground">+ Add key</strong> để thêm slot.
        </p>
        <div className="mt-2">
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            aistudio.google.com/apikey
          </a>
        </div>
      </div>

      <div className="space-y-3">
        {loadingExisting
          ? [0, 1].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 w-16 shrink-0" />
                </div>
              </div>
            ))
          : keys.map((value, idx) => (
              <KeyRow
                key={idx}
                index={idx}
                value={value}
                visible={!!show[idx]}
                status={testStatus[idx] ?? 'idle'}
                canRemove={keys.length > 1}
                required={idx === 0}
                onChange={(v) => setKeyAt(idx, v)}
                onToggleVisible={() =>
                  setShow((prev) => ({ ...prev, [idx]: !prev[idx] }))
                }
                onTest={() => testKey(idx)}
                onRemove={() => removeKey(idx)}
              />
            ))}
        {!loadingExisting && (
          <button
            type="button"
            onClick={addKey}
            className="flex items-center gap-1.5 border border-dashed border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add key
          </button>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">
          {loadingExisting ? (
            <Skeleton className="h-3 w-40" />
          ) : geminiCount === 0 ? (
            <span className="text-destructive">Cần ít nhất 1 Gemini key</span>
          ) : (
            <>
              <strong className="text-foreground">{geminiCount}</strong> Gemini key ·
              quota ~{geminiCount * 1500} chat/ngày
              {storeStatus === 'ready' && (
                <span className="ml-2 text-primary">· Đã active</span>
              )}
            </>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving || loadingExisting || geminiCount === 0}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Đang lưu...' : 'Lưu tokens'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// KeyRow
// ============================================================

function KeyRow({
  index,
  value,
  visible,
  status,
  canRemove,
  required,
  onChange,
  onToggleVisible,
  onTest,
  onRemove,
}: {
  index: number;
  value: string;
  visible: boolean;
  status: TestStatus;
  canRemove: boolean;
  required: boolean;
  onChange: (v: string) => void;
  onToggleVisible: () => void;
  onTest: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">
          Gemini Key #{index + 1}
          {required && <span className="ml-1 text-destructive">*</span>}
        </label>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-center gap-2">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={required ? 'AIza...' : 'AIza... (optional)'}
          className="h-8 font-mono text-xs"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          title={visible ? 'Ẩn' : 'Hiện'}
          className="h-8 w-8 shrink-0 border border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground"
        >
          {visible ? (
            <EyeOff className="mx-auto h-3.5 w-3.5" />
          ) : (
            <Eye className="mx-auto h-3.5 w-3.5" />
          )}
        </button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onTest}
          disabled={!value.trim() || status === 'testing'}
          className="h-8 px-2 text-xs"
        >
          {status === 'testing' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            'Test'
          )}
        </Button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Xoá key này"
            className="h-8 w-8 shrink-0 border border-border bg-background text-muted-foreground hover:border-destructive/50 hover:text-destructive"
          >
            <Trash2 className="mx-auto h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TestStatus }) {
  if (status === 'idle') return null;
  const map: Record<Exclude<TestStatus, 'idle'>, { label: string; cls: string }> = {
    testing: { label: 'Đang test...', cls: 'text-muted-foreground' },
    ok: { label: '✓ OK', cls: 'text-primary' },
    fail: { label: '✗ Fail', cls: 'text-destructive' },
  };
  const { label, cls } = map[status];
  return <span className={cn('font-mono text-[10px]', cls)}>{label}</span>;
}

// ============================================================
// Helpers
// ============================================================

function hashKeys(keys: string[]): string {
  return keys.join('\0');
}