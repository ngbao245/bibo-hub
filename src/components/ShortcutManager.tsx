
import { useEffect, useMemo, useRef, useState } from 'react';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';

import { useShortcutStore, type Shortcut } from '@/stores/shortcutStore';
import {
  useShortcutOverrides,
  useSaveShortcutOverrides,
  type ShortcutOverridesData,
} from '@/api/shortcutOverrides';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

// ============================================================
// ShortcutManager — config shortcut keys + enabled
// ============================================================

interface ShortcutManagerProps {
  onDirtyChange?: (dirty: boolean) => void;
}

export default function ShortcutManager({ onDirtyChange }: ShortcutManagerProps) {
  // Subscribe Map reference, memo array — tránh selector trả new array mỗi render
  const byId = useShortcutStore((s) => s.byId);
  const allShortcuts = useMemo(() => Array.from(byId.values()), [byId]);
  const ovQuery = useShortcutOverrides();
  const saveMut = useSaveShortcutOverrides();

  const [overrides, setOverrides] = useState<ShortcutOverridesData>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (ovQuery.data) {
      setOverrides(ovQuery.data.data);
    }
  }, [ovQuery.data]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  /** Resolve effective key + enabled cho 1 shortcut */
  function resolve(s: Shortcut): { key: string; enabled: boolean } {
    const ov = overrides[s.id];
    return {
      key: ov?.key ?? s.key,
      enabled: ov?.enabled ?? true,
    };
  }

  function setKey(id: string, key: string) {
    setOverrides((prev) => ({
      ...prev,
      [id]: { key, enabled: prev[id]?.enabled ?? true },
    }));
    setDirty(true);
  }

  function setEnabled(id: string, enabled: boolean) {
    setOverrides((prev) => {
      const cur = prev[id];
      const defaultKey = allShortcuts.find((s) => s.id === id)?.key ?? '';
      return {
        ...prev,
        [id]: { key: cur?.key ?? defaultKey, enabled },
      };
    });
    setDirty(true);
  }

  function resetOne(id: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDirty(true);
  }

  async function resetAll() {
    if (!window.confirm('Reset shortcuts? All custom shortcuts will be removed.')) return;
    setOverrides({});
    setDirty(true);
  }

  function handleSave() {
    saveMut.mutate(
      { data: overrides, recordId: ovQuery.data?.recordId ?? null },
      {
        onSuccess: () => {
          toast.success('Đã lưu shortcuts');
          setDirty(false);
        },
        onError: () => toast.error('Lỗi lưu'),
      },
    );
  }

  // Group by group field
  const groups = useMemo(() => {
    const map: Record<string, Shortcut[]> = {};
    for (const s of allShortcuts) {
      const g = s.group || 'Other';
      (map[g] ||= []).push(s);
    }
    return map;
  }, [allShortcuts]);

  // Conflict detection — count effective key collisions giữa các shortcut enabled
  const conflicts = useMemo(() => {
    const counts: Record<string, string[]> = {};
    for (const s of allShortcuts) {
      const r = resolve(s);
      if (!r.enabled) continue;
      (counts[r.key] ||= []).push(s.id);
    }
    const result: Record<string, string[]> = {};
    for (const [k, ids] of Object.entries(counts)) {
      if (ids.length > 1) result[k] = ids;
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allShortcuts, overrides]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pb-2">
        <span className="text-xs text-muted-foreground">
          {allShortcuts.length} shortcut · {Object.keys(conflicts).length} xung đột
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={resetAll} className="h-7 gap-1 px-2 text-xs">
            <RotateCcw className="h-3 w-3" />
            Reset all
          </Button>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={saveMut.isPending} className="h-7 gap-1 px-2 text-xs">
              <Save className="h-3 w-3" />
              {saveMut.isPending ? 'Đang lưu...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {Object.keys(conflicts).length > 0 && (
        <div className="mb-3 flex items-start gap-2 border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Có {Object.keys(conflicts).length} phím tắt bị trùng. Khi bấm, chỉ
            shortcut đăng ký sau cùng sẽ chạy.
          </span>
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(groups).map(([groupName, list]) => (
          <div key={groupName}>
            <h3 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {groupName}
            </h3>
            <div className="border border-border bg-card">
              {list.map((s, idx) => {
                const r = resolve(s);
                const hasConflict = !!conflicts[r.key];
                const isOverridden = !!overrides[s.id];
                return (
                  <ShortcutRow
                    key={s.id}
                    shortcut={s}
                    effectiveKey={r.key}
                    enabled={r.enabled}
                    overridden={isOverridden}
                    conflict={hasConflict}
                    onKeyChange={(k) => setKey(s.id, k)}
                    onEnabledChange={(e) => setEnabled(s.id, e)}
                    onReset={() => resetOne(s.id)}
                    isLast={idx === list.length - 1}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ShortcutRow — 1 dòng config
// ============================================================
function ShortcutRow({
  shortcut,
  effectiveKey,
  enabled,
  overridden,
  conflict,
  onKeyChange,
  onEnabledChange,
  onReset,
  isLast,
}: {
  shortcut: Shortcut;
  effectiveKey: string;
  enabled: boolean;
  overridden: boolean;
  conflict: boolean;
  onKeyChange: (k: string) => void;
  onEnabledChange: (e: boolean) => void;
  onReset: () => void;
  isLast: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 text-xs',
        !isLast && 'border-b border-border',
        !enabled && 'opacity-50',
      )}
    >
      <Checkbox
        checked={enabled}
        onCheckedChange={(c) => onEnabledChange(c === true)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground">{shortcut.label}</span>
          <span className="font-mono text-[10px] text-muted-foreground/60">{shortcut.id}</span>
        </div>
      </div>
      <ShortcutCapture
        value={effectiveKey}
        onChange={onKeyChange}
        disabled={!enabled}
        conflict={conflict}
      />
      {overridden && (
        <button
          onClick={onReset}
          title="Reset về default"
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// ShortcutCapture — click-to-capture phím tắt
// ============================================================
//
// Khi capturing=true:
//   - Listener gắn vào window ở capture phase → bắt phím TRƯỚC mọi
//     handler khác (textarea, button, global shortcut...).
//   - Set flag `capturing` lên store để useGlobalShortcuts skip
//     (defense in depth).
//   - Click ngoài button → cancel capture.
// ============================================================
function ShortcutCapture({
  value,
  onChange,
  disabled,
  conflict,
}: {
  value: string;
  onChange: (k: string) => void;
  disabled?: boolean;
  conflict?: boolean;
}) {
  const [capturing, setCapturing] = useState(false);
  const setStoreCapturing = useShortcutStore((s) => s.setCapturing);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setStoreCapturing(capturing);
    return () => setStoreCapturing(false);
  }, [capturing, setStoreCapturing]);

  // Window-level capture phase listener khi đang capture
  useEffect(() => {
    if (!capturing) return;

    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      const key = e.key.toLowerCase();
      if (['control', 'alt', 'shift', 'meta'].includes(key)) return;

      if (key === 'escape') {
        setCapturing(false);
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      if (e.metaKey) parts.push('meta');
      parts.push(key);

      onChange(parts.join('+'));
      setCapturing(false);
    }

    function onClickOutside(e: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setCapturing(false);
      }
    }

    // Capture phase = true để bắt trước các handler khác
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onClickOutside, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onClickOutside, true);
    };
  }, [capturing, onChange]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setCapturing((c) => !c)}
      disabled={disabled}
      className={cn(
        'inline-flex h-7 min-w-[120px] items-center justify-center border px-2 font-mono text-[11px] transition-colors',
        capturing
          ? 'border-primary bg-primary/10 text-primary'
          : conflict
            ? 'border-yellow-500/60 bg-yellow-500/10 text-yellow-400'
            : 'border-border bg-background text-foreground hover:border-primary',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {capturing ? (
        <span className="text-[10px]">Bấm phím tắt...</span>
      ) : (
        formatShortcut(value)
      )}
    </button>
  );
}

/** Format 'alt+shift+c' → 'Alt+Shift+C' */
function formatShortcut(key: string): string {
  return key
    .split('+')
    .map((k) => {
      if (k === 'ctrl') return 'Ctrl';
      if (k === 'alt') return 'Alt';
      if (k === 'shift') return 'Shift';
      if (k === 'meta') return 'Cmd';
      return k.charAt(0).toUpperCase() + k.slice(1);
    })
    .join('+');
}