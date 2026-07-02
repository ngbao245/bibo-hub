import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, ExternalLink, Loader2, Save, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  EMPTY_RAG_TOKENS,
  RagVaultError,
  type RagTokens,
} from '@/lib/rag/types';

// ============================================================
// RagTokensManager — UI chỉnh record group=RAG type=SettingInfor
// ============================================================
//
// Pattern giống ToolCategoryManager/ShortcutManager:
//   - Mount trong DialogContent (cha mở qua state)
//   - onDirtyChange báo cho parent để confirm khi đóng
//   - Self-fetch + self-save (không cần parent truyền data)
//
// Field schema:
//   - geminiApiKey1 (bắt buộc, encrypted)
//   - geminiApiKey2 (optional, encrypted)
//   - geminiApiKey3 (optional, encrypted)
//   - groqApiKey   (optional, encrypted)
// ============================================================

const RAG_GROUP = 'RAG';
const TOKENS_TYPE = 'SettingInfor';

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

interface KeyFieldState {
  name: keyof RagTokens;
  label: string;
  required: boolean;
  placeholder: string;
}

const FIELDS: KeyFieldState[] = [
  { name: 'geminiApiKey1', label: 'Gemini Key #1', required: true,  placeholder: 'AIza...' },
  { name: 'geminiApiKey2', label: 'Gemini Key #2', required: false, placeholder: 'AIza... (optional)' },
  { name: 'geminiApiKey3', label: 'Gemini Key #3', required: false, placeholder: 'AIza... (optional)' },
  { name: 'groqApiKey',    label: 'Groq Key',      required: false, placeholder: 'gsk_... (fallback, optional)' },
];

export default function RagTokensManager({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const settingsQuery = useSettings();
  const createMut = useCreateSetting();
  const updateMut = useUpdateSetting();
  const passphrase = useCryptoStore((s) => s.passphrase);

  const [tokens, setTokens] = useState<RagTokens>(EMPTY_RAG_TOKENS);
  const [originalHash, setOriginalHash] = useState<string>('');
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Tìm record hiện có
  const existingRecord = useMemo<Setting | undefined>(
    () =>
      settingsQuery.data?.find(
        (s) =>
          s.group.trim().toLowerCase() === RAG_GROUP.toLowerCase() &&
          s.type.trim().toLowerCase() === TOKENS_TYPE.toLowerCase(),
      ),
    [settingsQuery.data],
  );

  // Load + decrypt tokens hiện có (nếu record tồn tại)
  useEffect(() => {
    if (!existingRecord) return;
    let cancelled = false;
    setLoadingExisting(true);
    (async () => {
      try {
        const t = await loadRagTokens();
        if (cancelled) return;
        setTokens(t);
        setOriginalHash(hashTokens(t));
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
    onDirtyChange?.(hashTokens(tokens) !== originalHash);
  }, [tokens, originalHash, onDirtyChange]);

  function setField(name: keyof RagTokens, value: string) {
    setTokens((prev) => ({ ...prev, [name]: value }));
    setTestStatus((prev) => ({ ...prev, [name]: 'idle' }));
  }

  async function testKey(name: keyof RagTokens) {
    const k = tokens[name].trim();
    if (!k) {
      toast.error('Chưa có key để test');
      return;
    }
    setTestStatus((prev) => ({ ...prev, [name]: 'testing' }));

    try {
      // Test bằng cách gọi trực tiếp Gemini với key cụ thể, không qua pool
      // (để biết chính xác key đó valid không, không phụ thuộc rotation)
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

      if (name === 'groqApiKey') {
        await testGroq(k);
        setTestStatus((prev) => ({ ...prev, [name]: 'ok' }));
        toast.success('Groq key OK');
        return;
      }

      if (res.ok) {
        setTestStatus((prev) => ({ ...prev, [name]: 'ok' }));
        toast.success(`${name} OK`);
      } else {
        setTestStatus((prev) => ({ ...prev, [name]: 'fail' }));
        toast.error(`${name} HTTP ${res.status}`);
      }
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [name]: 'fail' }));
      toast.error('Test thất bại', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleSave() {
    if (!tokens.geminiApiKey1.trim()) {
      toast.error('Cần ít nhất 1 Gemini key (Key #1)');
      return;
    }

    // Passphrase fallback APP_SECRET nếu user chưa unlock Crypto modal
    const passKey = passphrase.trim() || APP_SECRET;
    if (!passKey) {
      toast.error('Không có passphrase để encrypt');
      return;
    }

    try {
      const entries: FieldEntry[] = [];
      for (const f of FIELDS) {
        const v = tokens[f.name].trim();
        if (!v) continue; // bỏ qua field rỗng
        const ct = await encryptText(v, passKey);
        entries.push({ k: f.name, e: 1, v: ct });
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
        description: 'RAG API keys (Gemini × 3 + Groq fallback)',
        group: RAG_GROUP,
        type: TOKENS_TYPE,
        ...slotMap,
      };

      if (existingRecord) {
        await updateMut.mutateAsync({ ...payload, id: existingRecord.id } as Setting);
      } else {
        await createMut.mutateAsync(payload);
      }

      setOriginalHash(hashTokens(tokens));
      toast.success('Đã lưu RAG tokens');

      // Re-bootstrap để pool sync với key mới
      await tryBootstrapRag();
    } catch (err) {
      toast.error('Lỗi lưu', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const dirty = hashTokens(tokens) !== originalHash;
  const saving = createMut.isPending || updateMut.isPending;
  const geminiCount = [tokens.geminiApiKey1, tokens.geminiApiKey2, tokens.geminiApiKey3]
    .filter((k) => k.trim().length > 0).length;
  const storeStatus = useRagStore((s) => s.status);

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-border bg-background/40 p-3 text-xs text-muted-foreground">
        <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Key pool rotation
        </p>
        <p>
          Tạo 1-3 Gemini API key từ các Google account riêng để tăng quota
          (15 RPM × 1500 RPD mỗi key, tổng <strong className="text-foreground">4,500
          chat/ngày</strong> với 3 key). Groq fallback dùng khi tất cả Gemini key hết quota.
        </p>
        <div className="mt-2 flex gap-3">
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            aistudio.google.com/apikey
          </a>
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            console.groq.com/keys
          </a>
        </div>
      </div>

      {loadingExisting && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Đang load token hiện có...
        </div>
      )}

      <div className="space-y-3">
        {FIELDS.map((f) => (
          <KeyRow
            key={f.name}
            field={f}
            value={tokens[f.name]}
            visible={!!show[f.name]}
            status={testStatus[f.name] ?? 'idle'}
            onChange={(v) => setField(f.name, v)}
            onToggleVisible={() =>
              setShow((prev) => ({ ...prev, [f.name]: !prev[f.name] }))
            }
            onTest={() => testKey(f.name)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">
          {geminiCount === 0 ? (
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
          disabled={!dirty || saving || !tokens.geminiApiKey1.trim()}
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
  field,
  value,
  visible,
  status,
  onChange,
  onToggleVisible,
  onTest,
}: {
  field: KeyFieldState;
  value: string;
  visible: boolean;
  status: TestStatus;
  onChange: (v: string) => void;
  onToggleVisible: () => void;
  onTest: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </label>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-center gap-2">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
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

function hashTokens(t: RagTokens): string {
  return [t.geminiApiKey1, t.geminiApiKey2, t.geminiApiKey3, t.groqApiKey].join('\0');
}

async function testGroq(key: string): Promise<void> {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
}