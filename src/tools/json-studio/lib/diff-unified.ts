import { diffJson, type DiffEntry } from './diff';

// ============================================================
// Unified diff renderer — build git-style diff từ JSON A + JSON B
// ============================================================
//
// Approach:
//   1. Pretty-stringify cả A và B với indent 2 spaces
//   2. Run diffJson(A, B) để lấy list changed paths
//   3. Với mỗi line trong A/B, determine trạng thái:
//      - Nếu path của line này match với path bị remove/change → dòng - (A)
//      - Nếu path bị add/change → dòng + (B)
//      - Else → context " "
//   4. Compress context: giữ ±3 dòng quanh mỗi change, hunks cách xa nhau
//      hiển thị separator `...`.
//
// Simpler impl: string-diff line by line dựa trên LCS. Không cần map path
// → line vì stringify đã deterministic (sort keys nếu cần).
//
// Kiro chọn approach line-diff LCS đơn giản hơn — không cần liên kết
// DiffEntry với line. Reuse `diffJson` chỉ để đếm change count cho header.
// ============================================================

export interface UnifiedLine {
  type: 'context' | 'add' | 'remove' | 'separator';
  text: string;
  lineA?: number; // 1-based, số dòng trong A
  lineB?: number; // 1-based, số dòng trong B
}

const CONTEXT_LINES = 3;

export interface UnifiedDiffResult {
  lines: UnifiedLine[];
  totalChanges: number;
  truncated: boolean;
}

export function buildUnifiedDiff(a: unknown, b: unknown): UnifiedDiffResult {
  const textA = safeStringify(a);
  const textB = safeStringify(b);

  const linesA = textA.split('\n');
  const linesB = textB.split('\n');

  const rawDiff = lcsDiff(linesA, linesB);

  // Track line numbers
  let lineA = 0;
  let lineB = 0;
  const enriched: UnifiedLine[] = rawDiff.map((d) => {
    if (d.type === 'remove') {
      lineA += 1;
      return { ...d, lineA };
    }
    if (d.type === 'add') {
      lineB += 1;
      return { ...d, lineB };
    }
    // context
    lineA += 1;
    lineB += 1;
    return { ...d, lineA, lineB };
  });

  // Compress context — giữ ±CONTEXT_LINES quanh change, gom hunks
  const changeIdx = new Set<number>();
  enriched.forEach((line, i) => {
    if (line.type === 'add' || line.type === 'remove') changeIdx.add(i);
  });

  const keepIdx = new Set<number>();
  for (const i of changeIdx) {
    for (let j = Math.max(0, i - CONTEXT_LINES); j <= Math.min(enriched.length - 1, i + CONTEXT_LINES); j++) {
      keepIdx.add(j);
    }
  }

  // Build compressed output với separator giữa các hunk
  const result: UnifiedLine[] = [];
  let lastKept = -1;
  for (let i = 0; i < enriched.length; i++) {
    if (!keepIdx.has(i)) continue;
    if (lastKept !== -1 && i > lastKept + 1) {
      result.push({ type: 'separator', text: '···' });
    }
    result.push(enriched[i]);
    lastKept = i;
  }

  // Count total changes qua diffJson (semantic count, không phải line count)
  const structural = diffJson(a, b);

  // Cap output ~1000 lines để tránh render quá nhiều
  const MAX_LINES = 1000;
  const truncated = result.length > MAX_LINES || structural.truncated;
  const finalLines = result.length > MAX_LINES ? result.slice(0, MAX_LINES) : result;

  return {
    lines: finalLines,
    totalChanges: structural.entries.length,
    truncated,
  };
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

// ============================================================
// LCS-based line diff — simple O(n*m) DP, đủ cho JSON < vài nghìn dòng.
// ============================================================
type RawDiff = { type: 'context' | 'add' | 'remove'; text: string };

function lcsDiff(a: string[], b: string[]): RawDiff[] {
  const m = a.length;
  const n = b.length;
  // DP table: dp[i][j] = LCS length của a[0..i], b[0..j]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Backtrack
  const out: RawDiff[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push({ type: 'context', text: a[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.push({ type: 'remove', text: a[i - 1] });
      i--;
    } else {
      out.push({ type: 'add', text: b[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    out.push({ type: 'remove', text: a[i - 1] });
    i--;
  }
  while (j > 0) {
    out.push({ type: 'add', text: b[j - 1] });
    j--;
  }
  return out.reverse();
}

export type { DiffEntry };