import { useEffect, useRef, useState } from 'react';
import { Search, Copy, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/shared';
import { useJsonStudioStore } from '@/stores/jsonStudioStore';
import { useDebouncedEffect } from '@/hooks/useDebouncedEffect';
import { copyToClipboard } from '@/lib/json-studio/workspace-utils';
import { cn } from '@/lib/cn';

// ============================================================
// PathWorkspace — JSONPath tester
// ============================================================
//
// Auto-run debounced 350ms sau khi expr hoặc data đổi. Không có nút Run.
// Cheatsheet chip click → điền expression → debounce → auto run.
// Click path trong result → copy expression path đó.
//
// Query token: request cũ bị stale nếu user gõ tiếp trong lúc async load
// jsonpath-plus (lazy import).
// ============================================================

interface Match {
  path: string;
  value: unknown;
}

interface Cheat {
  label: string;
  expr: string;
  hint: string;
}

const CHEATS: Cheat[] = [
  { label: '$..name', expr: '$..name', hint: 'Mọi key "name" bất kỳ tầng' },
  { label: '$.arr[*]', expr: '$.fruits[*]', hint: 'Duyệt mọi phần tử array' },
  { label: '[0]', expr: '$.fruits[0]', hint: 'Phần tử đầu tiên' },
  { label: '[-1:]', expr: '$.fruits[-1:]', hint: 'Phần tử cuối' },
  { label: '[?filter]', expr: '$.fruits[?(@.name=="Apple")]', hint: 'Filter theo điều kiện' },
  { label: '$..*', expr: '$..*', hint: 'Mọi giá trị (kể cả object/array)' },
];

export function PathWorkspace() {
  const rawData = useJsonStudioStore((s) => s.rawData);

  const [expr, setExpr] = useState('$..name');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showCheat, setShowCheat] = useState(true);

  const queryTokenRef = useRef(0);

  const run = async (target: string) => {
    if (!target.trim()) {
      setError(null);
      setMatches(null);
      setRunning(false);
      return;
    }
    const myToken = ++queryTokenRef.current;
    setError(null);
    setRunning(true);
    try {
      const { JSONPath } = await import('jsonpath-plus');
      const paths = JSONPath({
        path: target,
        json: rawData as object,
        resultType: 'path',
      }) as string[];
      const values = JSONPath({
        path: target,
        json: rawData as object,
        resultType: 'value',
      }) as unknown[];
      if (myToken !== queryTokenRef.current) return;
      const out: Match[] = paths.map((p, i) => ({ path: p, value: values[i] }));
      setMatches(out);
    } catch (err) {
      if (myToken !== queryTokenRef.current) return;
      setError(err instanceof Error ? err.message : 'JSONPath query failed');
      setMatches(null);
    } finally {
      if (myToken === queryTokenRef.current) setRunning(false);
    }
  };

  // Auto-run debounced khi expr hoặc data đổi.
  useDebouncedEffect(
    () => {
      void run(expr);
    },
    [expr, rawData],
    350
  );

  // Run lần đầu ngay khi mount (không đợi debounce) để user thấy default result.
  useEffect(() => {
    void run(expr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyAllValues = () => {
    if (!matches) return;
    const text = JSON.stringify(
      matches.map((m) => m.value),
      null,
      2
    );
    void copyToClipboard(text, `Copied ${matches.length} values`);
  };

  const handleCheatClick = (cheat: Cheat) => {
    setExpr(cheat.expr);
    // Debounced effect sẽ tự run khi expr đổi — không cần gọi run() thủ công.
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Input bar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="$..name  |  $.users[*]  |  $.items[?(@.price>10)]"
          className="h-8 flex-1 border border-border bg-background px-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {running && (
          <div
            className="h-3.5 w-3.5 shrink-0 animate-spin border-2 border-primary border-b-primary/30 border-r-primary/30"
            aria-label="Running query"
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCheat((v) => !v)}
          className="h-8 gap-1.5 text-xs"
          title="Toggle cheatsheet"
        >
          <Info className="h-3.5 w-3.5" />
          Help
        </Button>
      </div>

      {/* Cheatsheet chips */}
      {showCheat && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Presets:
          </span>
          {CHEATS.map((c) => (
            <button
              key={c.expr}
              type="button"
              onClick={() => handleCheatClick(c)}
              title={c.hint}
              className={cn(
                'inline-flex items-center border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground',
                'transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {error && (
          <div className="border-b border-border p-3">
            <ErrorState compact message={error} />
          </div>
        )}
        {!matches && !error && !running && (
          <EmptyState
            icon={Search}
            title="Type a JSONPath expression"
            description="Click a preset above or type directly."
          />
        )}
        {matches && matches.length === 0 && (
          <EmptyState
            icon={Search}
            title="No matches"
            description={`Expression "${expr}" matched no values.`}
          />
        )}
        {matches && matches.length > 0 && (
          <>
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
              <span className="text-xs text-muted-foreground">
                {matches.length} match{matches.length === 1 ? '' : 'es'} — click path để copy
                expression
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyAllValues}
                className="h-6 gap-1.5 text-xs"
              >
                <Copy className="h-3 w-3" />
                Copy values
              </Button>
            </div>
            <ul className="flex-1 divide-y divide-border/50 overflow-auto font-mono text-xs">
              {matches.map((m, idx) => (
                <li
                  key={idx}
                  className={cn('group flex flex-col gap-1 px-3 py-2 hover:bg-muted/40')}
                >
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(m.path, `Copied ${m.path}`)}
                    title="Click để copy path expression"
                    className={cn(
                      'inline-flex w-fit items-center gap-1 text-left text-primary/80 transition-colors',
                      'hover:text-primary hover:underline'
                    )}
                  >
                    <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    {m.path}
                  </button>
                  <span className="whitespace-pre-wrap break-all text-foreground">
                    {formatValue(m.value)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === undefined) return 'undefined';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}