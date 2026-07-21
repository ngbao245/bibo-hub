import { useMemo, useState } from 'react';
import { Copy, AlignLeft, Minimize2, ArrowUpAZ, ArrowDownAZ, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared';
import { useJsonStudioStore } from '@/tools/json-studio/store';
import { useJsonStudioEditorStore } from '@/tools/json-studio/editor-store';
import {
  copyToClipboard,
  deepSortKeys,
  detectJsonl,
  findJsonlSource,
  fromJsonLines,
  minifyJson,
  prettyJson,
  toJsonLines,
} from '@/tools/json-studio/lib/workspace-utils';
import { cn } from '@/lib/cn';

// ============================================================
// FormatWorkspace — Prettify / Minify / Sort keys / JSONL (smart)
// ============================================================
//
// 6 action:
//   - Prettify 2sp / 4sp
//   - Minify
//   - Sort keys ↑ / ↓
//   - JSONL (smart 2-way):
//     * Editor text đang là JSONL → parse lines → array → pretty JSON
//     * Editor text là JSON object có array key (VD `{fruits: [...]}`) → convert array → JSONL
//     * Data là array → convert → JSONL
//     * Nhiều array key → toast hint "chọn key nào" (Phase 2 giới hạn — không nhồi dropdown)
// ============================================================

type Action = 'prettify2' | 'prettify4' | 'minify' | 'sortAsc' | 'sortDesc' | 'jsonl';

interface ActionDef {
  id: Action;
  label: string;
  icon: typeof AlignLeft;
  hint?: string;
}

const ACTIONS: ActionDef[] = [
  { id: 'prettify2', label: 'Prettify (2sp)', icon: AlignLeft },
  { id: 'prettify4', label: 'Prettify (4sp)', icon: AlignLeft },
  { id: 'minify', label: 'Minify', icon: Minimize2 },
  { id: 'sortAsc', label: 'Sort keys ↑', icon: ArrowUpAZ },
  { id: 'sortDesc', label: 'Sort keys ↓', icon: ArrowDownAZ },
  { id: 'jsonl', label: 'JSONL', icon: Rows3, hint: 'Tự động detect JSON ↔ JSONL' },
];

export function FormatWorkspace() {
  const rawData = useJsonStudioStore((s) => s.rawData);

  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<Action | null>(null);

  const currentJson = useMemo(() => {
    try {
      return prettyJson(rawData, 2);
    } catch {
      return '';
    }
  }, [rawData]);

  const runJsonl = () => {
    // 1. Editor text có phải JSONL không? (multi-line, mỗi dòng parse được riêng)
    const editorText = useJsonStudioEditorStore.getState().text;
    const asArray = detectJsonl(editorText);
    if (asArray) {
      setOutput(prettyJson(asArray, 2));
      return;
    }

    // 2. Data là array → JSONL trực tiếp
    // 3. Data là object có array key → auto-pick + JSONL
    const { array, candidates } = findJsonlSource(rawData);
    if (array) {
      setOutput(toJsonLines(array));
      return;
    }

    // 4. Nhiều array key ambiguous
    if (candidates.length > 1) {
      throw new Error(
        `Data có nhiều array: [${candidates.join(', ')}]. Chưa hỗ trợ chọn — tách 1 array ra trước.`
      );
    }

    // 5. Không có array nào để convert
    throw new Error(
      'Data không phải JSONL (multi-line JSON) và không có array trong object. JSONL cần input là array of items.'
    );
  };

  const runAction = (action: Action) => {
    setError(null);
    setActiveAction(action);
    try {
      switch (action) {
        case 'prettify2':
          setOutput(prettyJson(rawData, 2));
          break;
        case 'prettify4':
          setOutput(prettyJson(rawData, 4));
          break;
        case 'minify':
          setOutput(minifyJson(rawData));
          break;
        case 'sortAsc':
          setOutput(prettyJson(deepSortKeys(rawData, 'asc'), 2));
          break;
        case 'sortDesc':
          setOutput(prettyJson(deepSortKeys(rawData, 'desc'), 2));
          break;
        case 'jsonl':
          runJsonl();
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Format action failed');
      setOutput('');
    }
  };

  // Fallback nếu user vẫn muốn parse JSONL từ text tuỳ ý (không qua auto-detect).
  // Ẩn behind advanced hint — không nhồi UI mặc định.
  const handleParseArbitraryJsonl = () => {
    const editorText = useJsonStudioEditorStore.getState().text;
    try {
      const arr = fromJsonLines(editorText);
      setOutput(prettyJson(arr, 2));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSONL parse failed');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-3 py-2">
        {ACTIONS.map(({ id, label, icon: Icon, hint }) => (
          <Button
            key={id}
            variant={activeAction === id ? 'default' : 'outline'}
            size="sm"
            onClick={() => runAction(id)}
            className="gap-1.5 text-xs"
            title={hint}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
        {output && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copyToClipboard(output, 'Copied output')}
            className="ml-auto gap-1.5 text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {error && (
          <div className="flex flex-col gap-2 border-b border-border p-3">
            <ErrorState compact message={error} />
            {activeAction === 'jsonl' && (
              <button
                type="button"
                onClick={handleParseArbitraryJsonl}
                className="text-left text-xs text-primary hover:underline"
              >
                Vẫn thử parse text hiện tại như JSONL →
              </button>
            )}
          </div>
        )}
        {output ? (
          <pre
            className={cn(
              'flex-1 overflow-auto whitespace-pre-wrap break-all bg-card p-3 font-mono text-xs text-foreground',
              'selection:bg-primary/30'
            )}
          >
            {output}
          </pre>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            <AlignLeft className="h-8 w-8 text-muted-foreground/40" />
            <p>Pick an action to format JSON.</p>
            <p className="text-xs text-muted-foreground/70">
              Current input: {currentJson.length} chars
            </p>
          </div>
        )}
      </div>
    </div>
  );
}