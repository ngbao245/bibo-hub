import { useEffect, useRef, useState } from 'react';
import { GitCompare, FileText, List, Pencil, CheckCheck } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/shared';
import { useJsonStudioStore } from '@/tools/json-studio/store';
import { useDebouncedEffect } from '@/hooks/useDebouncedEffect';
import { diffJson, type DiffEntry } from '@/tools/json-studio/lib/diff';
import { buildUnifiedDiff, type UnifiedDiffResult } from '@/tools/json-studio/lib/diff-unified';
import { cn } from '@/lib/cn';

// ============================================================
// DiffWorkspace — structural diff giữa JSON A và JSON B
// ============================================================
//
// 2 view mode:
//   - Unified: git-diff style, context ±3 dòng, gom hunks
//   - Summary: list per-entry (path + value block)
//
// Persist qua sessionStorage:
//   - jsonStudio.diff.bText.v1 — nội dung JSON B
//   - jsonStudio.diff.bLabel.v1 — tên label user đặt
//   - jsonStudio.diff.viewMode.v1 — view mode chọn cuối
// SessionStorage scope per tab — mở tool trong 2 tab riêng biệt không đè
// nhau, F5 hoặc chuyển route rồi quay lại vẫn còn.
// ============================================================

type ViewMode = 'unified' | 'summary';

interface Result {
  entries: DiffEntry[];
  truncated: boolean;
  unified: UnifiedDiffResult;
}

const KEY_TEXT = 'jsonStudio.diff.bText.v1';
const KEY_LABEL = 'jsonStudio.diff.bLabel.v1';
const KEY_VIEW = 'jsonStudio.diff.viewMode.v1';
const DEFAULT_LABEL = 'JSON B';

function loadSession(key: string, fallback: string): string {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore quota / disabled
  }
}

export function DiffWorkspace() {
  const rawData = useJsonStudioStore((s) => s.rawData);

  const [bText, setBTextRaw] = useState(() => loadSession(KEY_TEXT, ''));
  const [bLabel, setBLabelRaw] = useState(() => loadSession(KEY_LABEL, DEFAULT_LABEL));
  const [viewMode, setViewModeRaw] = useState<ViewMode>(
    () => (loadSession(KEY_VIEW, 'unified') as ViewMode) || 'unified'
  );
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  const setBText = (t: string) => {
    saveSession(KEY_TEXT, t);
    setBTextRaw(t);
  };
  const setBLabel = (l: string) => {
    const clean = l.trim() || DEFAULT_LABEL;
    saveSession(KEY_LABEL, clean);
    setBLabelRaw(clean);
  };
  const setViewMode = (v: ViewMode) => {
    saveSession(KEY_VIEW, v);
    setViewModeRaw(v);
  };

  useEffect(() => {
    if (editingLabel) {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    }
  }, [editingLabel]);

  const runDiff = () => {
    if (!bText.trim()) {
      setError(null);
      setResult(null);
      return;
    }
    setError(null);
    try {
      const b = JSON.parse(bText);
      const struct = diffJson(rawData, b);
      const unified = buildUnifiedDiff(rawData, b);
      setResult({ entries: struct.entries, truncated: struct.truncated, unified });
    } catch (err) {
      setError(`${bLabel} parse error: ` + (err instanceof Error ? err.message : 'invalid'));
      setResult(null);
    }
  };

  useDebouncedEffect(
    () => {
      runDiff();
    },
    [bText, rawData],
    400
  );

  useEffect(() => {
    runDiff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header: view mode switch + change summary */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <div
          role="tablist"
          aria-label="Diff view mode"
          className="inline-flex h-7 items-center bg-muted p-0.5 text-muted-foreground"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'unified'}
            onClick={() => setViewMode('unified')}
            title="Git-style diff với context xung quanh"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium transition-colors',
              viewMode === 'unified'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground'
            )}
          >
            <FileText className="h-3 w-3" />
            Unified
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'summary'}
            onClick={() => setViewMode('summary')}
            title="List từng change với path + value block"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium transition-colors',
              viewMode === 'summary'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground'
            )}
          >
            <List className="h-3 w-3" />
            Summary
          </button>
        </div>

        {result && !error && (
          <span className="ml-2 text-xs text-muted-foreground">
            {result.entries.length} change{result.entries.length === 1 ? '' : 's'}
            {result.truncated && (
              <span className="ml-2 text-warning">[!] truncated</span>
            )}
          </span>
        )}
      </div>

      {/* Body: JSON B input | Diff result */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
          <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {editingLabel ? (
              <input
                ref={labelInputRef}
                type="text"
                defaultValue={bLabel}
                maxLength={40}
                onBlur={(e) => {
                  setBLabel(e.target.value);
                  setEditingLabel(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setBLabel((e.target as HTMLInputElement).value);
                    setEditingLabel(false);
                  } else if (e.key === 'Escape') {
                    setEditingLabel(false);
                  }
                }}
                className="h-5 flex-1 border border-primary bg-background px-1 text-xs font-medium text-foreground focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingLabel(true)}
                title="Click để đổi tên"
                className={cn(
                  'group inline-flex items-center gap-1.5 text-left hover:text-foreground'
                )}
              >
                <span>{bLabel}</span>
                <Pencil className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-60" />
              </button>
            )}
          </div>
          <TextareaWithLineNumbers
            value={bText}
            onChange={setBText}
            placeholder={'{\n  "key": "value"\n}'}
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            {error && (
              <div className="p-3">
                <ErrorState compact message={error} />
              </div>
            )}
            {!result && !error && (
              <EmptyState
                compact
                icon={GitCompare}
                title="No diff yet"
                description={`Paste ${bLabel} to compare with editor data.`}
              />
            )}
            {result && !error && result.entries.length === 0 && (
              <EmptyState
                compact
                icon={CheckCheck}
                title="No differences"
                description="The two JSON objects are identical."
              />
            )}
            {result && !error && result.entries.length > 0 && (
              <>
                {viewMode === 'unified' ? (
                  <UnifiedView result={result.unified} />
                ) : (
                  <SummaryView entries={result.entries} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Unified view — git-diff style với line number gutter A|B
// ============================================================
function UnifiedView({ result }: { result: UnifiedDiffResult }) {
  // Max line number để tính width gutter cho nhất quán
  const maxLineNum = result.lines.reduce(
    (max, l) => Math.max(max, l.lineA ?? 0, l.lineB ?? 0),
    0
  );
  const gutterWidth = String(maxLineNum).length;

  return (
    <pre className="min-h-0 flex-1 overflow-auto bg-card p-0 font-mono text-xs leading-relaxed">
      {result.lines.map((line, idx) => {
        if (line.type === 'separator') {
          return (
            <div
              key={idx}
              className="select-none px-3 py-0.5 text-center text-muted-foreground/50"
            >
              {line.text}
            </div>
          );
        }
        const symbol = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
        const bg =
          line.type === 'add'
            ? 'bg-success/10'
            : line.type === 'remove'
              ? 'bg-destructive/10'
              : '';
        const symbolColor =
          line.type === 'add'
            ? 'text-success'
            : line.type === 'remove'
              ? 'text-destructive'
              : 'text-muted-foreground/50';
        const textColor =
          line.type === 'add'
            ? 'text-success/90'
            : line.type === 'remove'
              ? 'text-destructive/90'
              : 'text-foreground/80';

        return (
          <div
            key={idx}
            className={cn('flex items-baseline gap-1 whitespace-pre px-2 py-0', bg)}
          >
            {/* Gutter: line A | line B */}
            <span
              className="select-none tabular-nums text-muted-foreground/50"
              style={{ minWidth: `${gutterWidth}ch` }}
            >
              {line.lineA ? String(line.lineA).padStart(gutterWidth, ' ') : ' '.repeat(gutterWidth)}
            </span>
            <span
              className="select-none tabular-nums text-muted-foreground/50"
              style={{ minWidth: `${gutterWidth}ch` }}
            >
              {line.lineB ? String(line.lineB).padStart(gutterWidth, ' ') : ' '.repeat(gutterWidth)}
            </span>
            <span className={cn('w-3 shrink-0 select-none text-center', symbolColor)}>
              {symbol}
            </span>
            <span className={textColor}>{line.text || ' '}</span>
          </div>
        );
      })}
    </pre>
  );
}

// ============================================================
// TextareaWithLineNumbers — textarea + gutter số dòng sync scroll
// ============================================================
function TextareaWithLineNumbers({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lines = value.split('\n');
  const lineCount = lines.length;
  const digits = String(lineCount).length;

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="select-none overflow-hidden border-r border-border bg-muted/30 py-3 pl-2 pr-2 font-mono text-xs leading-normal tabular-nums text-muted-foreground/60"
        style={{ minWidth: `${digits + 2}ch` }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-xs leading-normal focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  );
}

// ============================================================
// Summary view — list per-entry
// ============================================================
function SummaryView({ entries }: { entries: DiffEntry[] }) {
  return (
    <ul className="space-y-0.5 p-2 font-mono text-xs">
      {entries.map((entry, idx) => (
        <SummaryEntryRow key={idx} entry={entry} />
      ))}
    </ul>
  );
}

function SummaryEntryRow({ entry }: { entry: DiffEntry }) {
  const symbol = entry.type === 'add' ? '+' : entry.type === 'remove' ? '-' : '~';
  const color =
    entry.type === 'add'
      ? 'text-success'
      : entry.type === 'remove'
        ? 'text-destructive'
        : 'text-warning';

  return (
    <li className={cn('flex flex-col gap-1 px-2 py-1 hover:bg-muted/50', color)}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-bold">{symbol}</span>
        <span className="shrink-0 text-foreground/70">{entry.path}</span>
      </div>
      {entry.type === 'change' ? (
        <div className="ml-5 flex flex-col gap-1">
          <ValueBlock label="from" value={entry.oldValue} tone="destructive" />
          <ValueBlock label="to" value={entry.newValue} tone="success" />
        </div>
      ) : (
        <ValueBlock
          label={null}
          value={entry.type === 'add' ? entry.newValue : entry.oldValue}
          tone={entry.type === 'add' ? 'success' : 'destructive'}
        />
      )}
    </li>
  );
}

function ValueBlock({
  label,
  value,
  tone,
}: {
  label: string | null;
  value: unknown;
  tone: 'success' | 'destructive';
}) {
  const isComplex = value !== null && typeof value === 'object';
  const toneClass = tone === 'success' ? 'text-success/90' : 'text-destructive/90';

  if (!isComplex) {
    return (
      <div className="ml-5 flex items-baseline gap-1.5 text-foreground/80">
        {label && <span className="text-[10px] uppercase text-muted-foreground">{label}</span>}
        <span className={toneClass}>{renderPrimitive(value)}</span>
      </div>
    );
  }

  const pretty = prettyStringify(value);
  return (
    <div className="ml-5 flex flex-col gap-0.5">
      {label && <span className="text-[10px] uppercase text-muted-foreground">{label}</span>}
      <pre
        className={cn(
          'whitespace-pre-wrap break-all border-l-2 bg-muted/30 px-2 py-1 text-[11px] leading-snug',
          tone === 'success' ? 'border-success/40' : 'border-destructive/40',
          toneClass
        )}
      >
        {pretty}
      </pre>
    </div>
  );
}

function renderPrimitive(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}

function prettyStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}