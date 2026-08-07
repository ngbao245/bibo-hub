// ============================================================
// PDF Studio — Generic history state hook (undo/redo)
// ============================================================
// Snapshot-based history stack. Consumer cung cấp cloneFn để control
// shallow/deep clone (VD PageEntry[] chỉ cần shallow map).
// Keyboard shortcut Ctrl/Cmd+Z (undo), Ctrl+Y hoặc Ctrl+Shift+Z (redo)
// auto attach vào window nếu enableShortcuts=true.
//
// Design: dùng refs (stateRef, historyRef, indexRef) làm source of truth
// cho commit/undo/redo — tránh closure stale + strict mode double-invoke
// gây bug push history 2 lần.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseHistoryStateOptions<T> {
  cloneFn?: (value: T) => T;
  limit?: number;
  enableShortcuts?: boolean;
}

export interface HistoryStateApi<T> {
  state: T;
  setStateSilent: (next: T | ((prev: T) => T)) => void;
  commit: (next: T | ((prev: T) => T)) => void;
  reset: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historyLength: number;
}

export function useHistoryState<T>(
  initial: T,
  options: UseHistoryStateOptions<T> = {},
): HistoryStateApi<T> {
  const { cloneFn = (v) => v, limit = 30, enableShortcuts = true } = options;

  const [state, setStateRaw] = useState<T>(initial);
  const [history, setHistory] = useState<T[]>(() => [cloneFn(initial)]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Refs cho source of truth trong callbacks — tránh closure stale
  const stateRef = useRef(state);
  const historyRef = useRef(history);
  const indexRef = useRef(historyIndex);
  const cloneFnRef = useRef(cloneFn);
  stateRef.current = state;
  historyRef.current = history;
  indexRef.current = historyIndex;
  cloneFnRef.current = cloneFn;

  const setStateSilent = useCallback((next: T | ((prev: T) => T)) => {
    if (typeof next === 'function') {
      const updater = next as (p: T) => T;
      const value = updater(stateRef.current);
      stateRef.current = value;
      setStateRaw(value);
    } else {
      stateRef.current = next;
      setStateRaw(next);
    }
  }, []);

  const commit = useCallback(
    (next: T | ((prev: T) => T)) => {
      const value =
        typeof next === 'function'
          ? (next as (p: T) => T)(stateRef.current)
          : next;
      const snap = cloneFnRef.current(value);

      // Update state
      stateRef.current = value;
      setStateRaw(value);

      // Push snapshot dùng refs (không phụ thuộc closure state)
      const currentIdx = indexRef.current;
      const currentHist = historyRef.current;
      const trimmed = currentHist.slice(0, currentIdx + 1);
      const merged = [...trimmed, snap];
      const newHist = merged.length > limit ? merged.slice(merged.length - limit) : merged;
      const newIdx = newHist.length - 1;

      historyRef.current = newHist;
      indexRef.current = newIdx;
      setHistory(newHist);
      setHistoryIndex(newIdx);
    },
    [limit],
  );

  const reset = useCallback((next: T) => {
    const snap = cloneFnRef.current(next);
    stateRef.current = next;
    historyRef.current = [snap];
    indexRef.current = 0;
    setStateRaw(next);
    setHistory([snap]);
    setHistoryIndex(0);
  }, []);

  const undo = useCallback(() => {
    const idx = indexRef.current;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    const target = cloneFnRef.current(historyRef.current[newIdx]);
    stateRef.current = target;
    indexRef.current = newIdx;
    setStateRaw(target);
    setHistoryIndex(newIdx);
  }, []);

  const redo = useCallback(() => {
    const idx = indexRef.current;
    const hist = historyRef.current;
    if (idx >= hist.length - 1) return;
    const newIdx = idx + 1;
    const target = cloneFnRef.current(hist[newIdx]);
    stateRef.current = target;
    indexRef.current = newIdx;
    setStateRaw(target);
    setHistoryIndex(newIdx);
  }, []);

  // Throttle giữ Ctrl+Z (key repeat) — single press vẫn instant.
  // 50ms → max ~20 undo/s khi giữ, đủ nhanh mà không spam re-render.
  const lastKeyRepeatRef = useRef(0);
  const KEY_REPEAT_THROTTLE_MS = 50;

  useEffect(() => {
    if (!enableShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const isUndo = e.key === 'z' && !e.shiftKey;
      const isRedo = e.key === 'y' || (e.key === 'z' && e.shiftKey);
      if (!isUndo && !isRedo) return;

      // Throttle chỉ áp cho key repeat (giữ phím). First press bỏ qua.
      if (e.repeat) {
        const now = performance.now();
        if (now - lastKeyRepeatRef.current < KEY_REPEAT_THROTTLE_MS) return;
        lastKeyRepeatRef.current = now;
      } else {
        lastKeyRepeatRef.current = performance.now();
      }

      e.preventDefault();
      if (isUndo) undo();
      else redo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enableShortcuts, undo, redo]);

  return {
    state,
    setStateSilent,
    commit,
    reset,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    historyIndex,
    historyLength: history.length,
  };
}
