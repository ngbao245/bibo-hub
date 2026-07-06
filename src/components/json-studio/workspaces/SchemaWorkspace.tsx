import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Copy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/shared';
import { useJsonStudioStore } from '@/stores/jsonStudioStore';
import { useDebouncedEffect } from '@/hooks/useDebouncedEffect';
import { inferSchema } from '@/lib/json-studio/infer-schema';
import { copyToClipboard, prettyJson } from '@/lib/json-studio/workspace-utils';
import { cn } from '@/lib/cn';

// ============================================================
// SchemaWorkspace — JSON Schema validator
// ============================================================
//
// Layout: header actions + schema textarea full width + result inline/panel.
// - Valid → result compact 1 dòng inline dưới textarea (32px)
// - Invalid → result expand panel list errors (max-h-40%)
//
// Data meta hiển thị ở global bar dưới TabBar (khi editor đóng) — workspace
// này không lặp lại.
// ============================================================

interface AjvError {
  instancePath: string;
  message?: string;
  keyword: string;
}

interface ValidationResult {
  valid: boolean;
  errors: AjvError[];
}

// Ajv cache module scope
type AjvCtor = typeof import('ajv').default;
type AddFormats = typeof import('ajv-formats').default;
let ajvCache: { Ajv: AjvCtor; addFormats: AddFormats } | null = null;
let ajvLoading: Promise<{ Ajv: AjvCtor; addFormats: AddFormats }> | null = null;

async function getAjv() {
  if (ajvCache) return ajvCache;
  if (!ajvLoading) {
    ajvLoading = Promise.all([import('ajv'), import('ajv-formats')]).then(
      ([AjvModule, AddFormatsModule]) => {
        ajvCache = { Ajv: AjvModule.default, addFormats: AddFormatsModule.default };
        return ajvCache;
      }
    );
  }
  return ajvLoading;
}

let schemaTextCache: string | null = null;

export function SchemaWorkspace() {
  const rawData = useJsonStudioStore((s) => s.rawData);

  const [schemaText, setSchemaTextRaw] = useState(() => {
    if (schemaTextCache !== null) return schemaTextCache;
    try {
      const inferred = prettyJson(inferSchema(rawData), 2);
      schemaTextCache = inferred;
      return inferred;
    } catch {
      schemaTextCache = '{}';
      return '{}';
    }
  });

  const setSchemaText = (next: string) => {
    schemaTextCache = next;
    setSchemaTextRaw(next);
  };

  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const tokenRef = useRef(0);

  const runValidate = async () => {
    const myToken = ++tokenRef.current;
    setError(null);
    const needsLoad = !ajvCache;
    if (needsLoad) setRunning(true);
    try {
      let schema: unknown;
      try {
        schema = JSON.parse(schemaText);
      } catch (err) {
        throw new Error('Schema JSON parse error: ' + (err as Error).message);
      }

      const { Ajv, addFormats } = await getAjv();
      if (myToken !== tokenRef.current) return;

      const ajv = new Ajv({ allErrors: true, strict: false });
      addFormats(ajv);
      const validateFn = ajv.compile(schema as object);
      const valid = validateFn(rawData);
      if (myToken !== tokenRef.current) return;
      const errors = (validateFn.errors ?? []).map((e) => ({
        instancePath: e.instancePath || '/',
        message: e.message,
        keyword: e.keyword,
      }));
      setResult({ valid: !!valid, errors });
    } catch (err) {
      if (myToken !== tokenRef.current) return;
      setError(err instanceof Error ? err.message : 'Validation failed');
      setResult(null);
    } finally {
      if (myToken === tokenRef.current) setRunning(false);
    }
  };

  useDebouncedEffect(
    () => {
      void runValidate();
    },
    [schemaText, rawData],
    400
  );

  useEffect(() => {
    void runValidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInfer = () => {
    try {
      const inferred = inferSchema(rawData);
      setSchemaText(prettyJson(inferred, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Infer failed');
    }
  };

  const showResultPanel = error || (result && !result.valid);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header: actions */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        {running && (
          <div
            className="h-3 w-3 shrink-0 animate-spin border-2 border-primary border-b-primary/30 border-r-primary/30"
            aria-label="Validating"
          />
        )}
        {/* Valid result inline compact */}
        {result && result.valid && !error && !running && (
          <div className="flex items-center gap-1.5 text-xs text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Data matches schema</span>
          </div>
        )}
        {result && !result.valid && !error && !running && (
          <div className="text-xs text-destructive">
            {result.errors.length} validation error{result.errors.length === 1 ? '' : 's'}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleInfer}
            title="Auto-generate schema từ data hiện tại"
            className="h-7 gap-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Infer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copyToClipboard(schemaText, 'Copied schema')}
            className="h-7 gap-1.5 text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
      </div>

      {/* Schema textarea — full width, chiếm max space */}
      <textarea
        value={schemaText}
        onChange={(e) => setSchemaText(e.target.value)}
        className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-xs focus:outline-none"
        spellCheck={false}
        placeholder='{ "type": "object", "properties": {...}, "required": [...] }'
      />

      {/* Error panel + invalid list — chỉ hiện khi cần */}
      {showResultPanel && (
        <div className="max-h-[40%] shrink-0 overflow-auto border-t border-border bg-card">
          {error && (
            <div className="p-3">
              <ErrorState compact message={error} />
            </div>
          )}
          {result && !result.valid && !error && (
            <ul className="p-2 space-y-0.5 font-mono text-xs">
              {result.errors.map((e, idx) => (
                <li
                  key={idx}
                  className={cn(
                    'flex items-start gap-2 px-2 py-1 text-destructive hover:bg-muted/50'
                  )}
                >
                  <span className="shrink-0 text-foreground/70">{e.instancePath || '/'}</span>
                  <span>{e.message ?? e.keyword}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Empty state khi chưa có gì */}
      {!result && !error && !running && (
        <div className="shrink-0 border-t border-border bg-card p-3">
          <EmptyState compact icon={ShieldCheck} title="Chưa validate" />
        </div>
      )}
    </div>
  );
}