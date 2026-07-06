// ============================================================
// Structural JSON diff — self-roll, recursive deep compare
// ============================================================
//
// Trả về flat array of DiffEntry với path (string) và type. Tránh dep
// `jsondiffpatch` ~40KB gzip cho case đơn giản này.
//
// Rule:
//   - Object: compare key set. Missing bên B → 'remove'. Missing bên A → 'add'.
//   - Array: index-based compare (không LCS). Item excess bên B → 'add', bên A → 'remove'.
//   - Primitive: `Object.is` để so sánh (NaN === NaN, +0 !== -0).
//   - Deep nested: recurse. Path string joined qua `.` cho object key, `[i]` cho array index.
// ============================================================

export type DiffType = 'add' | 'remove' | 'change';

export interface DiffEntry {
  path: string;
  type: DiffType;
  oldValue?: unknown;
  newValue?: unknown;
}

const MAX_ENTRIES = 500;

export function diffJson(a: unknown, b: unknown): { entries: DiffEntry[]; truncated: boolean } {
  const entries: DiffEntry[] = [];
  let truncated = false;

  function walk(x: unknown, y: unknown, path: string) {
    if (entries.length >= MAX_ENTRIES) {
      truncated = true;
      return;
    }

    // Both null/undefined → same
    if (x === undefined && y === undefined) return;
    if (x === null && y === null) return;

    // Type mismatch → change
    const tx = getType(x);
    const ty = getType(y);
    if (tx !== ty) {
      entries.push({ path: path || '$', type: 'change', oldValue: x, newValue: y });
      return;
    }

    if (tx === 'object') {
      const keysA = Object.keys(x as Record<string, unknown>);
      const keysB = Object.keys(y as Record<string, unknown>);
      const all = new Set([...keysA, ...keysB]);
      for (const k of all) {
        const nextPath = path ? `${path}.${k}` : k;
        const va = (x as Record<string, unknown>)[k];
        const vb = (y as Record<string, unknown>)[k];
        if (!(k in (y as object))) {
          entries.push({ path: nextPath, type: 'remove', oldValue: va });
        } else if (!(k in (x as object))) {
          entries.push({ path: nextPath, type: 'add', newValue: vb });
        } else {
          walk(va, vb, nextPath);
        }
        if (entries.length >= MAX_ENTRIES) {
          truncated = true;
          return;
        }
      }
      return;
    }

    if (tx === 'array') {
      const aa = x as unknown[];
      const bb = y as unknown[];
      const len = Math.max(aa.length, bb.length);
      for (let i = 0; i < len; i++) {
        const nextPath = `${path}[${i}]`;
        if (i >= bb.length) {
          entries.push({ path: nextPath, type: 'remove', oldValue: aa[i] });
        } else if (i >= aa.length) {
          entries.push({ path: nextPath, type: 'add', newValue: bb[i] });
        } else {
          walk(aa[i], bb[i], nextPath);
        }
        if (entries.length >= MAX_ENTRIES) {
          truncated = true;
          return;
        }
      }
      return;
    }

    // primitive
    if (!Object.is(x, y)) {
      entries.push({ path: path || '$', type: 'change', oldValue: x, newValue: y });
    }
  }

  walk(a, b, '');
  return { entries, truncated };
}

function getType(v: unknown): 'null' | 'undefined' | 'array' | 'object' | 'primitive' {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  return 'primitive';
}