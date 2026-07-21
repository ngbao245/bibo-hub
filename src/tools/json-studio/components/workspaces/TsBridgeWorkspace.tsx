import { useEffect, useState } from 'react';
import { Code, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared';
import { useJsonStudioStore } from '@/tools/json-studio/store';
import { useDebouncedEffect } from '@/hooks/useDebouncedEffect';
import { jsonToTs, tsToSchema } from '@/tools/json-studio/lib/ts-bridge';
import { copyToClipboard } from '@/tools/json-studio/lib/workspace-utils';
import { cn } from '@/lib/cn';

// ============================================================
// TsBridgeWorkspace — 2 mode: JSON → TS interface | TS → JSON Schema
// ============================================================
//
// Layout theo mode:
// - `json-to-ts`: 1 pane full width cho output (input = editor bên trái)
// - `ts-to-schema`: 2 pane (TS input textarea + Schema output)
//
// Auto convert debounce 350ms. State cache module-scope qua tab switch.
// ============================================================

type Mode = 'json-to-ts' | 'ts-to-schema';

const DEFAULT_TS = `export interface User {
  id: number;
  name: string;
  email?: string;
  active: boolean;
  tags: string[];
}`;

let tsInputCache: string | null = null;
let modeCache: Mode = 'json-to-ts';

export function TsBridgeWorkspace() {
  const rawData = useJsonStudioStore((s) => s.rawData);

  const [mode, setModeRaw] = useState<Mode>(modeCache);
  const [tsInput, setTsInputRaw] = useState(() => tsInputCache ?? DEFAULT_TS);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setMode = (m: Mode) => {
    modeCache = m;
    setModeRaw(m);
  };
  const setTsInput = (t: string) => {
    tsInputCache = t;
    setTsInputRaw(t);
  };

  const runConvert = () => {
    setError(null);
    try {
      if (mode === 'json-to-ts') {
        setOutput(jsonToTs(rawData));
      } else {
        const schema = tsToSchema(tsInput);
        setOutput(JSON.stringify(schema, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Convert failed');
      setOutput('');
    }
  };

  useDebouncedEffect(
    () => {
      runConvert();
    },
    [mode, tsInput, rawData],
    350
  );

  useEffect(() => {
    runConvert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header: mode switch + copy */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <div
          role="tablist"
          aria-label="Mode"
          className="inline-flex h-7 items-center bg-muted p-0.5 text-muted-foreground"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'json-to-ts'}
            onClick={() => setMode('json-to-ts')}
            className={cn(
              'px-2.5 py-0.5 text-xs font-medium transition-colors',
              mode === 'json-to-ts'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground'
            )}
          >
            JSON → TS
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'ts-to-schema'}
            onClick={() => setMode('ts-to-schema')}
            className={cn(
              'px-2.5 py-0.5 text-xs font-medium transition-colors',
              mode === 'ts-to-schema'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground'
            )}
          >
            TS → Schema
          </button>
        </div>

        {output && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copyToClipboard(output, 'Copied output')}
            className="ml-auto h-7 gap-1.5 text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        )}
      </div>

      {/* Body — layout theo mode */}
      {mode === 'json-to-ts' ? (
        // 1 pane full width — output TypeScript. Data lấy từ editor bên trái.
        <div className="flex min-h-0 flex-1 flex-col">
          {error && (
            <div className="p-3">
              <ErrorState compact message={error} />
            </div>
          )}
          {output && !error && (
            <pre className="flex-1 overflow-auto whitespace-pre-wrap break-all bg-card p-3 font-mono text-xs text-foreground">
              {output}
            </pre>
          )}
          {!output && !error && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              <Code className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs">Đang chờ input...</p>
            </div>
          )}
        </div>
      ) : (
        // 2 pane — TS input trái + JSON Schema output phải
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
            <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              TypeScript input
            </div>
            <textarea
              value={tsInput}
              onChange={(e) => setTsInput(e.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-xs focus:outline-none"
              placeholder="export interface User { ... }"
            />
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              JSON Schema output
            </div>
            {error && (
              <div className="p-3">
                <ErrorState compact message={error} />
              </div>
            )}
            {output && !error && (
              <pre className="flex-1 overflow-auto whitespace-pre-wrap break-all bg-card p-3 font-mono text-xs text-foreground">
                {output}
              </pre>
            )}
            {!output && !error && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                <Code className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-xs">Đang chờ input...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}