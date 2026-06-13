
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  Copy,
  Trash2,
  X,
} from 'lucide-react';

import { useSessionStorage } from '@/hooks/useSessionStorage';
import CodeEditor from '@/components/CodeEditor';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

// ============================================================
// Code Compare — full page, session-persistent, merge support
// ============================================================

export default function CodeComparePage() {
  const [left, setLeft] = useSessionStorage('code_compare_left', '');
  const [right, setRight] = useSessionStorage('code_compare_right', '');

  const diff = useMemo(() => computeDiff(left, right), [left, right]);
  const hunks = useMemo(() => groupHunks(diff), [diff]);

  // Track per-hunk decisions: 'take' | 'reject' | undefined (pending)
  const [decisions, setDecisions] = useState<Record<number, 'take' | 'reject'>>({});

  function setDecision(hunkIdx: number, d: 'take' | 'reject') {
    setDecisions((prev) => ({ ...prev, [hunkIdx]: d }));
  }

  function clearDecisions() {
    setDecisions({});
  }

  // Build merged result from decisions
  const merged = useMemo(() => {
    const lines: string[] = [];
    hunks.forEach((hunk, idx) => {
      const dec = decisions[idx];
      for (const d of hunk.lines) {
        if (d.type === 'equal') {
          lines.push(d.line);
        } else if (d.type === 'added') {
          // added = from right. Take = include, reject = skip
          if (dec === 'take') lines.push(d.line);
          // reject or pending: skip
        } else {
          // removed = from left. Take (accept change) = remove it, reject = keep it
          if (dec !== 'take') lines.push(d.line);
        }
      }
    });
    return lines.join('\n');
  }, [hunks, decisions]);

  const allDecided = hunks.every(
    (h, i) => h.type === 'equal' || decisions[i] !== undefined,
  );

  function swap() {
    const tmp = left;
    setLeft(right);
    setRight(tmp);
    clearDecisions();
  }

  function clear() {
    setLeft('');
    setRight('');
    clearDecisions();
  }

  function copyMerged() {
    navigator.clipboard.writeText(merged);
    toast.success('Đã copy merged result');
  }

  function copyDiff() {
    const text = diff
      .map((d) => {
        if (d.type === 'equal') return `  ${d.line}`;
        if (d.type === 'removed') return `- ${d.line}`;
        return `+ ${d.line}`;
      })
      .join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Đã copy diff');
  }

  function acceptAll() {
    const next: Record<number, 'take' | 'reject'> = {};
    hunks.forEach((h, i) => {
      if (h.type !== 'equal') next[i] = 'take';
    });
    setDecisions(next);
  }

  function rejectAll() {
    const next: Record<number, 'take' | 'reject'> = {};
    hunks.forEach((h, i) => {
      if (h.type !== 'equal') next[i] = 'reject';
    });
    setDecisions(next);
  }

  const stats = useMemo(() => {
    let added = 0, removed = 0, unchanged = 0;
    for (const d of diff) {
      if (d.type === 'added') added++;
      else if (d.type === 'removed') removed++;
      else unchanged++;
    }
    return { added, removed, unchanged };
  }, [diff]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-sm font-semibold text-foreground">Code Compare</h1>
          <span className="text-xs text-muted-foreground">
            <span className="text-green-400">+{stats.added}</span>{' '}
            <span className="text-red-400">-{stats.removed}</span>{' '}
            <span>~{stats.unchanged}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="outline" size="sm" onClick={swap} className="h-7 gap-1 px-2 text-xs">
            <ArrowRightLeft className="h-3 w-3" />
            Swap
          </Button>
          <Button variant="outline" size="sm" onClick={clear} className="h-7 gap-1 px-2 text-xs">
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
          {diff.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={copyDiff} className="h-7 gap-1 px-2 text-xs">
                <Copy className="h-3 w-3" />
                Diff
              </Button>
              <Button variant="outline" size="sm" onClick={acceptAll} className="h-7 gap-1 px-2 text-xs">
                <Check className="h-3 w-3" />
                Accept all
              </Button>
              <Button variant="outline" size="sm" onClick={rejectAll} className="h-7 gap-1 px-2 text-xs">
                <X className="h-3 w-3" />
                Reject all
              </Button>
              {allDecided && (
                <Button size="sm" onClick={copyMerged} className="h-7 gap-1 px-2 text-xs">
                  <Copy className="h-3 w-3" />
                  Copy merged
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Input panels */}
      <div className="grid flex-1 grid-cols-2 gap-0 overflow-hidden border-b border-border">
        <div className="flex flex-col border-r border-border">
          <div className="border-b border-border bg-card px-3 py-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Original (left)
            </span>
          </div>
          <CodeEditor
            value={left}
            onChange={(v) => { setLeft(v); clearDecisions(); }}
            placeholder="Paste code gốc..."
          />
        </div>
        <div className="flex flex-col">
          <div className="border-b border-border bg-card px-3 py-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Modified (right)
            </span>
          </div>
          <CodeEditor
            value={right}
            onChange={(v) => { setRight(v); clearDecisions(); }}
            placeholder="Paste code đã sửa..."
          />
        </div>
      </div>

      {/* Diff panel with line numbers + merge actions */}
      {diff.length > 0 && (
        <div className="max-h-[40vh] overflow-y-auto bg-background">
          {hunks.map((hunk, hunkIdx) => (
            <HunkBlock
              key={hunkIdx}
              hunk={hunk}
              decision={decisions[hunkIdx]}
              onDecide={(d) => setDecision(hunkIdx, d)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// HunkBlock — nhóm liên tiếp cùng type, hiện line numbers + action
// ============================================================

function HunkBlock({
  hunk,
  decision,
  onDecide,
}: {
  hunk: Hunk;
  decision?: 'take' | 'reject';
  onDecide: (d: 'take' | 'reject') => void;
}) {
  const isChange = hunk.type !== 'equal';

  return (
    <div
      className={cn(
        'relative',
        isChange && 'border-l-2',
        isChange && !decision && 'border-l-yellow-500',
        decision === 'take' && 'border-l-green-500',
        decision === 'reject' && 'border-l-red-500',
      )}
    >
      {/* Merge action buttons for change hunks */}
      {isChange && !decision && (
        <div className="absolute right-2 top-0.5 z-10 flex gap-0.5">
          <button
            onClick={() => onDecide('take')}
            title="Accept change (dùng bản mới)"
            className="flex h-5 items-center gap-0.5 border border-green-500/50 bg-green-500/10 px-1.5 text-[10px] text-green-400 hover:bg-green-500/20"
          >
            <Check className="h-2.5 w-2.5" />
            Accept
          </button>
          <button
            onClick={() => onDecide('reject')}
            title="Reject change (giữ bản gốc)"
            className="flex h-5 items-center gap-0.5 border border-red-500/50 bg-red-500/10 px-1.5 text-[10px] text-red-400 hover:bg-red-500/20"
          >
            <X className="h-2.5 w-2.5" />
            Reject
          </button>
        </div>
      )}
      {isChange && decision && (
        <div className="absolute right-2 top-0.5 z-10">
          <span
            className={cn(
              'inline-flex h-5 items-center px-1.5 text-[10px] font-medium',
              decision === 'take' && 'text-green-400',
              decision === 'reject' && 'text-red-400',
            )}
          >
            {decision === 'take' ? '✓ Accepted' : '✗ Rejected'}
          </span>
        </div>
      )}

      {hunk.lines.map((d, i) => (
        <div
          key={i}
          className={cn(
            'flex font-mono text-xs leading-5',
            d.type === 'added' && 'bg-green-500/10 text-green-400',
            d.type === 'removed' && 'bg-red-500/10 text-red-400',
            d.type === 'equal' && 'text-muted-foreground',
            decision === 'reject' && d.type === 'added' && 'opacity-30 line-through',
            decision === 'take' && d.type === 'removed' && 'opacity-30 line-through',
          )}
        >
          {/* Line number left (original) — blank for added lines */}
          <span className="w-8 shrink-0 select-none border-r border-border/50 px-1 text-right text-[10px] text-muted-foreground/40">
            {d.leftNum ?? ''}
          </span>
          {/* Line number right (modified) — blank for removed lines */}
          <span className="w-8 shrink-0 select-none border-r border-border px-1 text-right text-[10px] text-muted-foreground/40">
            {d.rightNum ?? ''}
          </span>
          {/* Indicator */}
          <span className="w-5 shrink-0 select-none text-center opacity-60">
            {d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ''}
          </span>
          {/* Content */}
          <span className="whitespace-pre-wrap break-all pr-20">{d.line || ' '}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Diff engine — LCS with line numbers
// ============================================================

interface DiffLine {
  type: 'equal' | 'added' | 'removed';
  line: string;
  leftNum?: number;
  rightNum?: number;
}

interface Hunk {
  type: 'equal' | 'change';
  lines: DiffLine[];
}

function computeDiff(a: string, b: string): DiffLine[] {
  if (!a && !b) return [];
  const linesA = a.split('\n');
  const linesB = b.split('\n');

  const m = linesA.length;
  const n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack with line numbers
  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      result.push({ type: 'equal', line: linesA[i - 1], leftNum: i, rightNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', line: linesB[j - 1], rightNum: j });
      j--;
    } else {
      result.push({ type: 'removed', line: linesA[i - 1], leftNum: i });
      i--;
    }
  }

  return result.reverse();
}

/** Group consecutive diff lines into hunks (equal vs change) */
function groupHunks(diff: DiffLine[]): Hunk[] {
  if (diff.length === 0) return [];
  const hunks: Hunk[] = [];
  let current: Hunk = { type: diff[0].type === 'equal' ? 'equal' : 'change', lines: [] };

  for (const d of diff) {
    const isEq = d.type === 'equal';
    const curIsEq = current.type === 'equal';
    if (isEq !== curIsEq) {
      if (current.lines.length > 0) hunks.push(current);
      current = { type: isEq ? 'equal' : 'change', lines: [] };
    }
    current.lines.push(d);
  }
  if (current.lines.length > 0) hunks.push(current);

  return hunks;
}