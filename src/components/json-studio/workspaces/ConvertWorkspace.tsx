import { useEffect, useMemo, useState } from 'react';
import { Copy, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared';
import { useJsonStudioStore } from '@/stores/jsonStudioStore';
import { ALL_FORMATS, FORMAT_META, stringifyByFormat } from '@/lib/json-studio/formats';
import { copyToClipboard } from '@/lib/json-studio/workspace-utils';
import { cn } from '@/lib/cn';
import type { SourceFormat } from '@/lib/json-studio/types';

// ============================================================
// ConvertWorkspace — convert JSON store hiện tại sang YAML/XML/CSV/JSONL
// ============================================================
//
// Reuse `stringifyByFormat` từ lib/json-studio/formats. Không tự viết
// parser. Target format dropdown → auto stringify.
//
// CSV fail nếu data không phải array of flat objects.
// XML wrap thêm root nếu data không phải object.
// ============================================================

export function ConvertWorkspace() {
  const rawData = useJsonStudioStore((s) => s.rawData);
  const sourceFormat = useJsonStudioStore((s) => s.sourceFormat);

  const targetOptions = useMemo(
    () => ALL_FORMATS.filter((f) => f !== sourceFormat),
    [sourceFormat]
  );

  const [target, setTarget] = useState<SourceFormat>(
    targetOptions[0] ?? (sourceFormat === 'yaml' ? 'json' : 'yaml')
  );
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setConverting(true);
      setError(null);
      try {
        const content = await stringifyByFormat(rawData, target);
        if (cancelled) return;
        if (content === null) {
          setError(`Không convert được sang ${FORMAT_META[target].label}. Data shape không phù hợp.`);
          setOutput('');
          return;
        }
        setOutput(content);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Convert failed');
        setOutput('');
      } finally {
        if (!cancelled) setConverting(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [rawData, target]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <span className="text-xs uppercase text-muted-foreground">{FORMAT_META[sourceFormat].label}</span>
        <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as SourceFormat)}
          className="h-7 border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {ALL_FORMATS.map((f) => (
            <option key={f} value={f} disabled={f === sourceFormat}>
              {FORMAT_META[f].label}
            </option>
          ))}
        </select>
        {converting && (
          <div className="h-3 w-3 animate-spin border-2 border-primary border-b-primary/30 border-r-primary/30" />
        )}
        {output && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copyToClipboard(output, `Copied ${FORMAT_META[target].label}`)}
            className="ml-auto gap-1.5 text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {error && (
          <div className="border-b border-border p-3">
            <ErrorState compact message={error} />
          </div>
        )}
        {output && (
          <pre
            className={cn(
              'flex-1 overflow-auto whitespace-pre-wrap break-all bg-card p-3 font-mono text-xs text-foreground',
              'selection:bg-primary/30'
            )}
          >
            {output}
          </pre>
        )}
      </div>
    </div>
  );
}