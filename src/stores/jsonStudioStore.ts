import { create } from 'zustand';
import type { SourceFormat, ViewMode } from '@/lib/json-studio/types';

// ============================================================
// JSON Studio Store - state cho /json-studio route
// ============================================================
//
// Học từ JSON Crack: tách 2 stage state để Graph view không bị block khi user gõ/paste.
//   - editorText: text trong textarea, update MỖI keystroke (controlled input)
//   - committedData: data đã parse, dùng cho Graph/Tree view, update DEBOUNCED 400ms
//
// Graph subscribe committedData (không subscribe editorText) → ELK chỉ chạy khi user
// đã dừng gõ 400ms → không có ELK overlapping → không lag tích lũy.
// ============================================================

interface JsonStudioState {
  /** Data đã parse + commit cho view (Graph / Tree) đọc. Update debounced. */
  rawData: unknown;
  sourceFormat: SourceFormat;
  sourceFilename: string;
  dataVersion: number;

  viewMode: ViewMode;
  editorOpen: boolean;

  setData: (data: unknown, format: SourceFormat, filename: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setEditorOpen: (open: boolean) => void;
  reset: () => void;
}

const SAMPLE_JSON: Record<string, unknown> = {
  fruits: [
    {
      name: 'Apple',
      color: '#FF0000',
      details: { type: 'Pome', season: 'Fall' },
      nutrients: { calories: 52, fiber: '2.4g', vitaminC: '4.6mg' },
    },
    {
      name: 'Banana',
      color: '#FFFF00',
      details: { type: 'Berry', season: 'Year-round' },
      nutrients: { calories: 89, fiber: '2.6g', potassium: '358mg' },
    },
    {
      name: 'Orange',
      color: '#FFA500',
      details: { type: 'Citrus', season: 'Winter' },
      nutrients: { calories: 47, fiber: '2.4g', vitaminC: '53.2mg' },
    },
  ],
};

export const useJsonStudioStore = create<JsonStudioState>((set) => ({
  rawData: SAMPLE_JSON,
  sourceFormat: 'json',
  sourceFilename: 'sample.json',
  dataVersion: 0,
  viewMode: 'graph',
  editorOpen: true,

  setData: (data, format, filename) => {
    import('@/lib/json-studio/calculateNodeSize').then((m) => m.clearNodeSizeCache());
    set((state) => ({
      rawData: data,
      sourceFormat: format,
      sourceFilename: filename,
      dataVersion: state.dataVersion + 1,
    }));
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setEditorOpen: (editorOpen) => set({ editorOpen }),

  reset: () => {
    // Clear persisted editor state để Reset thật sự đưa về sample.
    try {
      sessionStorage.removeItem('jsonStudio.editor.v1');
    } catch {
      // ignore
    }
    set((state) => ({
      rawData: SAMPLE_JSON,
      sourceFormat: 'json',
      sourceFilename: 'sample.json',
      viewMode: 'graph',
      dataVersion: state.dataVersion + 1,
    }));
    // Sync editor text về sample — nếu không, debounced parse trong editor
    // store sẽ commit text cũ đè lên rawData ta vừa set.
    // Dynamic import để tránh circular dependency giữa 2 store.
    void import('./jsonStudioEditorStore').then(({ useJsonStudioEditorStore }) => {
      const sampleText = JSON.stringify(SAMPLE_JSON, null, 2);
      useJsonStudioEditorStore.getState().syncFromData(sampleText);
    });
  },
}));

export { SAMPLE_JSON };