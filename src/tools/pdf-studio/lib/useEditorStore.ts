// ============================================================
// PDF Studio Edit PDF — Runtime editor store (Zustand)
// ============================================================
// Not persisted directly; hydrates from IndexedDB draft on open.
// Holds active tool, selection, objects, history and viewport state.
// ============================================================

import { create } from 'zustand';
import type { EditorObject } from './editor-objects';

// ─── Command for Undo/Redo ───────────────────────────────────

export interface HistoryEntry {
  description: string;
  objectsBefore: EditorObject[];
  objectsAfter: EditorObject[];
}

// ─── Store ───────────────────────────────────────────────────

interface EditorStoreState {
  // Objects
  objects: EditorObject[];
  selectedIds: string[];

  // History
  history: HistoryEntry[];
  historyIndex: number; // points to current state (-1 = initial)

  // Viewport
  currentPage: number;
  totalPages: number;
  zoom: number;

  // Dirty flag
  dirty: boolean;

  // Internal: snapshot for continuous gestures (drag/resize/color change)
  _gestureSnapshot: EditorObject[] | null;

  // Actions — Objects
  setObjects: (objs: EditorObject[]) => void;
  addObject: (obj: EditorObject) => void;
  updateObject: (id: string, partial: Partial<EditorObject>) => void;
  deleteObjects: (ids: string[]) => void;

  // Actions — Selection
  select: (ids: string[]) => void;
  clearSelection: () => void;

  // Actions — History
  pushHistory: (description: string, before: EditorObject[], after: EditorObject[]) => void;
  startGesture: () => void; // Call when continuous gesture starts (saves snapshot)
  commitGesture: (description: string) => void; // Call when continuous gesture ends
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions — Viewport
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setZoom: (zoom: number) => void;

  // Actions — Reset
  reset: () => void;
}

const MAX_HISTORY = 100;

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  objects: [],
  selectedIds: [],
  history: [],
  historyIndex: -1,
  currentPage: 1,
  totalPages: 0,
  zoom: 100,
  dirty: false,
  _gestureSnapshot: null,

  // setObjects: FULL reset (dùng khi mở draft mới, upload file mới)
  // Không leak history/selection cross-draft như trước.
  setObjects: (objs) =>
    set({
      objects: objs,
      selectedIds: [],
      history: [],
      historyIndex: -1,
      dirty: false,
      _gestureSnapshot: null,
    }),

  addObject: (obj) => {
    const before = get().objects;
    const after = [...before, obj];
    set({ objects: after, dirty: true });
    get().pushHistory(`Add ${obj.type}`, before, after);
  },

  updateObject: (id, partial) => {
    const before = get().objects;
    const after = before.map((o) =>
      o.id === id ? { ...o, ...partial } as EditorObject : o,
    );
    set({ objects: after, dirty: true });
    // Note: caller should batch property changes and push history manually for gestures
  },

  deleteObjects: (ids) => {
    const before = get().objects;
    const after = before.filter((o) => !ids.includes(o.id));
    set({ objects: after, selectedIds: [], dirty: true });
    get().pushHistory(`Delete ${ids.length} object(s)`, before, after);
  },

  select: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),

  pushHistory: (description, before, after) => {
    const { history, historyIndex } = get();
    // Truncate redo branch
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ description, objectsBefore: before, objectsAfter: after });
    // Cap history
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  startGesture: () => {
    // Save current state as snapshot before continuous modifications
    if (get()._gestureSnapshot === null) {
      set({ _gestureSnapshot: [...get().objects] });
    }
  },

  commitGesture: (description) => {
    // Called when a continuous gesture (drag/resize/property edit) ends.
    // Captures snapshot at start → current objects as one history entry.
    const state = get();
    if (state._gestureSnapshot) {
      // Only push if changed
      const changed = JSON.stringify(state._gestureSnapshot) !== JSON.stringify(state.objects);
      if (changed) {
        get().pushHistory(description, state._gestureSnapshot, state.objects);
      }
      set({ _gestureSnapshot: null });
    }
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < 0) return;
    const entry = history[historyIndex];
    set({
      objects: entry.objectsBefore,
      historyIndex: historyIndex - 1,
      dirty: true,
      selectedIds: [],
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const entry = history[historyIndex + 1];
    set({
      objects: entry.objectsAfter,
      historyIndex: historyIndex + 1,
      dirty: true,
      selectedIds: [],
    });
  },

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (total) => set({ totalPages: total }),
  setZoom: (zoom) => set({ zoom }),

  reset: () => set({
    objects: [],
    selectedIds: [],
    history: [],
    historyIndex: -1,
    currentPage: 1,
    totalPages: 0,
    zoom: 100,
    dirty: false,
    _gestureSnapshot: null,
  }),
}));
