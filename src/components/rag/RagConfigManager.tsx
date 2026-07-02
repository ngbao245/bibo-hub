import { useEffect, useMemo, useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';

import { useSettings, useCreateSetting, useUpdateSetting } from '@/api/setting';
import { CONFIG_KEYS, EMPTY_SETTING, type Setting, type SettingInput } from '@/lib/setting';
import { encodeFieldSlots, type FieldEntry } from '@/lib/cryptoFields';
import { cn } from '@/lib/cn';

import {
  DEFAULT_RAG_CONFIG,
  type EntityType,
  type RagChatMode,
  type RagConfig,
} from '@/lib/rag/types';
import { loadRagConfig } from '@/lib/rag/rag-config';
import { tryBootstrapRag } from '@/lib/rag/auto-bootstrap';
import type { NoteType } from '@/schemas/note';
import BackfillButton from './BackfillButton';

/** Entity types có thể áp filter min length. `book_chunk` bỏ (phase sau). */
const FILTERABLE_ENTITY_TYPES: Array<{ value: EntityType; label: string }> = [
  { value: 'note',      label: 'Notes' },
  { value: 'task',      label: 'Tasks' },
  { value: 'highlight', label: 'Highlights' },
];

// ============================================================
// RagConfigManager — UI chỉnh record group=RAG type=Config
// ============================================================
//
// Field schema (plaintext, không encrypt):
//   - enabledNoteTypes (CSV)
//   - embedTasks (bool)
//   - embedHighlights (bool)
//   - embedBookChunks (bool)
//   - chatDefaultMode ('auto'|'internal')
//   - similarityThreshold (number 0..1)
// ============================================================

const RAG_GROUP = 'RAG';
const CONFIG_TYPE = 'Config';

/**
 * Full list note types trong app.
 *
 * - `secret` luôn bị hard filter ở dual-write.ts, UI disable tick để user
 *   biết không thể enable.
 * - Type JSON (savings/expense/keycap_inventory): user tự chịu — content
 *   là JSON, embed ít nghĩa semantic nhưng vẫn tick được nếu muốn tìm theo
 *   tên/tag.
 * - Hint hiển thị lý do cho từng type để user chọn có ý thức.
 */
const AVAILABLE_NOTE_TYPES: Array<{
  value: NoteType;
  label: string;
  hint?: string;
  disabled?: boolean;
}> = [
  { value: 'note',    label: 'note',    hint: 'Note thường (mặc định)' },
  { value: 'ielts',   label: 'ielts',   hint: 'Vocab / grammar' },
  { value: 'course',  label: 'course',  hint: 'Note khóa học' },
  { value: 'code',    label: 'code',    hint: 'Code snippet' },
  { value: 'source',  label: 'source',  hint: 'Sources page' },
  { value: 'movie',   label: 'movie',   hint: 'Phim đơn lẻ' },
  { value: 'series',  label: 'series',  hint: 'Series / TV show' },
  { value: 'order',   label: 'order',   hint: 'Order tracking' },
  { value: 'savings', label: 'savings', hint: 'Saving fund — content là JSON, embed nhẹ' },
  { value: 'secret',  label: 'secret',  hint: 'Luôn loại trừ (hard filter)', disabled: true },
];

export default function RagConfigManager({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const settingsQuery = useSettings();
  const createMut = useCreateSetting();
  const updateMut = useUpdateSetting();

  const [config, setConfig] = useState<RagConfig>(DEFAULT_RAG_CONFIG);
  const [originalHash, setOriginalHash] = useState<string>('');

  const existingRecord = useMemo<Setting | undefined>(
    () =>
      settingsQuery.data?.find(
        (s) =>
          s.group.trim().toLowerCase() === RAG_GROUP.toLowerCase() &&
          s.type.trim().toLowerCase() === CONFIG_TYPE.toLowerCase(),
      ),
    [settingsQuery.data],
  );

  // Load existing config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await loadRagConfig();
        if (cancelled) return;
        setConfig(c);
        setOriginalHash(hashConfig(c));
      } catch {
        // ignore — dùng default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onDirtyChange?.(hashConfig(config) !== originalHash);
  }, [config, originalHash, onDirtyChange]);

  function toggleNoteType(t: NoteType, on: boolean) {
    setConfig((prev) => ({
      ...prev,
      enabledNoteTypes: on
        ? Array.from(new Set([...prev.enabledNoteTypes, t]))
        : prev.enabledNoteTypes.filter((x) => x !== t),
    }));
  }

  function toggleFilterApplyTo(t: EntityType, on: boolean) {
    setConfig((prev) => ({
      ...prev,
      minLength: {
        ...prev.minLength,
        applyTo: on
          ? Array.from(new Set([...prev.minLength.applyTo, t]))
          : prev.minLength.applyTo.filter((x) => x !== t),
      },
    }));
  }

  async function handleSave() {
    try {
      const entries: FieldEntry[] = [
        { k: 'enabledNoteTypes',    e: 0, v: config.enabledNoteTypes.join(',') },
        { k: 'embedTasks',          e: 0, v: String(config.embedTasks) },
        { k: 'embedHighlights',     e: 0, v: String(config.embedHighlights) },
        { k: 'embedBookChunks',     e: 0, v: String(config.embedBookChunks) },
        { k: 'chatDefaultMode',     e: 0, v: config.chatDefaultMode },
        { k: 'similarityThreshold', e: 0, v: String(config.similarityThreshold) },
        { k: 'minLengthEnabled',    e: 0, v: String(config.minLength.enabled) },
        { k: 'minLengthChars',      e: 0, v: String(config.minLength.minChars) },
        { k: 'minLengthApplyTo',    e: 0, v: config.minLength.applyTo.join(',') },
      ];

      const slots = encodeFieldSlots(entries);
      if (slots.length > CONFIG_KEYS.length) {
        toast.error(`Vượt ${CONFIG_KEYS.length} slot`);
        return;
      }

      const slotMap = {} as Record<(typeof CONFIG_KEYS)[number], string>;
      for (const k of CONFIG_KEYS) slotMap[k] = '';
      slots.forEach((s, i) => {
        slotMap[CONFIG_KEYS[i]] = s;
      });

      const payload: SettingInput = {
        ...EMPTY_SETTING,
        description: 'RAG config — nguồn dữ liệu, chat mode, shortcut',
        group: RAG_GROUP,
        type: CONFIG_TYPE,
        ...slotMap,
      };

      if (existingRecord) {
        await updateMut.mutateAsync({ ...payload, id: existingRecord.id } as Setting);
      } else {
        await createMut.mutateAsync(payload);
      }

      setOriginalHash(hashConfig(config));
      toast.success('Đã lưu RAG config');

      // Reload store
      await tryBootstrapRag();
    } catch (err) {
      toast.error('Lỗi lưu', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const dirty = hashConfig(config) !== originalHash;
  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div className="flex flex-col gap-5">
      {/* Section: Nguồn dữ liệu */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Nguồn dữ liệu
        </h3>
        <div className="space-y-3 border border-border bg-background/40 p-3">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Chọn note types được index. Loại{' '}
              <code className="text-destructive">secret</code> luôn bị loại trừ.
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {AVAILABLE_NOTE_TYPES.map((t) => {
                const checked = t.disabled
                  ? false
                  : config.enabledNoteTypes.includes(t.value);
                return (
                  <label
                    key={t.value}
                    className={cn(
                      'flex items-start gap-2 border border-border bg-background px-2 py-1.5 text-xs transition-colors',
                      t.disabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer hover:border-primary/40',
                      checked && !t.disabled && 'border-primary/60 bg-primary/5',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={t.disabled}
                      onCheckedChange={(c) => toggleNoteType(t.value, c === true)}
                      className="mt-0.5"
                    />
                    <div className="flex min-w-0 flex-col leading-tight">
                      <span className="font-mono text-foreground">{t.label}</span>
                      {t.hint && (
                        <span className="mt-0.5 text-[10px] text-muted-foreground">
                          {t.hint}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <ToggleRow
              label="Index tasks (title + status + priority + dueDate)"
              checked={config.embedTasks}
              onChange={(v) => setConfig((p) => ({ ...p, embedTasks: v }))}
            />
            <ToggleRow
              label="Index reader highlights"
              checked={config.embedHighlights}
              onChange={(v) => setConfig((p) => ({ ...p, embedHighlights: v }))}
            />
            <ToggleRow
              label="Index PDF full-text (Phase 4)"
              checked={config.embedBookChunks}
              onChange={(v) => setConfig((p) => ({ ...p, embedBookChunks: v }))}
            />
          </div>
        </div>
      </section>

      {/* Section: Chat */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chat
        </h3>
        <div className="space-y-3 border border-border bg-background/40 p-3">
          <div>
            <label className="text-xs text-muted-foreground">Mode mặc định</label>
            <div className="mt-1 flex gap-2">
              {(['auto', 'internal'] as RagChatMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setConfig((p) => ({ ...p, chatDefaultMode: m }))}
                  className={cn(
                    'flex-1 border px-3 py-1.5 text-xs transition-colors',
                    config.chatDefaultMode === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/40',
                  )}
                >
                  {m === 'auto' ? '🌐 Auto (notes + LLM)' : '📚 Internal (chỉ notes)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Similarity threshold (Auto mode)
              </span>
              <span className="font-mono text-foreground">
                {config.similarityThreshold.toFixed(2)}
              </span>
            </label>
            <input
              type="range"
              min={0.4}
              max={0.8}
              step={0.05}
              value={config.similarityThreshold}
              onChange={(e) =>
                setConfig((p) => ({ ...p, similarityThreshold: Number(e.target.value) }))
              }
              className="mt-1 w-full accent-primary"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              ≥ ngưỡng → cite notes. Tăng nếu AI cite linh tinh, giảm nếu bỏ sót.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Filter độ dài */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Filter độ dài content
        </h3>
        <div className="space-y-3 border border-border bg-background/40 p-3">
          <ToggleRow
            label="Bật filter — bỏ qua content quá ngắn"
            checked={config.minLength.enabled}
            onChange={(v) =>
              setConfig((p) => ({
                ...p,
                minLength: { ...p.minLength, enabled: v },
              }))
            }
          />

          {config.minLength.enabled && (
            <>
              <div>
                <label className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Ngưỡng ký tự tối thiểu
                  </span>
                  <span className="font-mono text-foreground">
                    {config.minLength.minChars} ký tự
                  </span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={config.minLength.minChars}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      minLength: { ...p.minLength, minChars: Number(e.target.value) },
                    }))
                  }
                  className="mt-1 w-full accent-primary"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Đếm sau khi strip HTML. Default 50 ký tự.
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Áp dụng cho entity type nào:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FILTERABLE_ENTITY_TYPES.map((t) => {
                    const checked = config.minLength.applyTo.includes(t.value);
                    return (
                      <label
                        key={t.value}
                        className={cn(
                          'flex cursor-pointer items-center gap-1.5 border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:border-primary/40',
                          checked && 'border-primary/60 bg-primary/5',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            toggleFilterApplyTo(t.value, c === true)
                          }
                        />
                        <span className="text-foreground">{t.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Type không tick sẽ bypass filter, embed mọi độ dài.
                </p>
              </div>
            </>
          )}

          <p className="text-[10px] text-muted-foreground">
            Filter cứng vẫn giữ: content rỗng / không có chữ cái luôn bị skip
            dù filter tắt.
          </p>
        </div>
      </section>

      {/* Warning */}
      <div className="flex gap-2 border border-yellow-500/40 bg-yellow-500/5 p-3 text-xs text-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
        <p>
          Đổi nguồn dữ liệu (tắt note type, bật/tắt tasks/highlights) sẽ trigger
          cleanup + backfill background ở Phase 1.
        </p>
      </div>

      {/* Backfill */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Đồng bộ
        </h3>
        <BackfillButton />
      </section>

      {/* Footer */}
      <div className="flex justify-end border-t border-border pt-3">
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Đang lưu...' : 'Lưu config'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// ToggleRow
// ============================================================

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5 text-xs">
      <span className="text-foreground">{label}</span>
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(c === true)} />
    </label>
  );
}

// ============================================================
// Helpers
// ============================================================

function hashConfig(c: RagConfig): string {
  return [
    [...c.enabledNoteTypes].sort().join(','),
    c.embedTasks,
    c.embedHighlights,
    c.embedBookChunks,
    c.chatDefaultMode,
    c.similarityThreshold,
    c.minLength.enabled,
    c.minLength.minChars,
    [...c.minLength.applyTo].sort().join(','),
  ].join('|');
}