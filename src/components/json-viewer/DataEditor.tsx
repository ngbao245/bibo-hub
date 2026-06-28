import { useEffect, useRef } from 'react';
import { PanelLeftClose } from 'lucide-react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { Button } from '@/components/ui/button';
import { useJsonViewerStore } from '@/stores/jsonViewerStore';
import { useJsonViewerEditorStore } from '@/stores/jsonViewerEditorStore';
import {
  buildExtensions,
  getLanguageExtension,
  languageCompartment,
} from '@/lib/json-viewer/codemirror-setup';
import { IOPanel } from './IOPanel';
import { cn } from '@/lib/cn';

// ============================================================
// DataEditor — CodeMirror 6 editor cho route /json-viewer
// ============================================================
//
// Pattern parse debounced vẫn giữ:
//   - User gõ → CodeMirror updateListener → setText → editorStore.text
//   - editorStore debounce 400ms → parse → commit sang jsonViewerStore.rawData
//   - GraphView subscribe rawData → ELK chỉ rebuild khi user ngừng gõ
//
// Bridge React ↔ CodeMirror:
//   - EditorState là source-of-truth cho CodeMirror. Khi store.text đổi
//     từ ngoài (Reset / Import / Format switch), ta dispatch transaction
//     replace toàn bộ doc. Để né loop (dispatch → updateListener → setText
//     → re-dispatch), updateListener chỉ gọi setText nếu doc khác text
//     trong store (compare bằng ref `lastSyncedTextRef`).
//   - Language compartment cho phép reconfigure khi đổi format mà không
//     phải re-create EditorView (giữ history, scroll, selection).
// ============================================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

export function DataEditor() {
  const sourceFormat = useJsonViewerStore((s) => s.sourceFormat);
  const filename = useJsonViewerStore((s) => s.sourceFilename);
  const setEditorOpen = useJsonViewerStore((s) => s.setEditorOpen);

  const text = useJsonViewerEditorStore((s) => s.text);
  const parsing = useJsonViewerEditorStore((s) => s.parsing);
  const error = useJsonViewerEditorStore((s) => s.error);
  const setText = useJsonViewerEditorStore((s) => s.setText);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Lưu text gần nhất đã sync để né update loop giữa CM ↔ store.
  const lastSyncedTextRef = useRef<string>(text);

  // === Mount EditorView 1 lần ===
  useEffect(() => {
    if (!hostRef.current) return;
    const initialText = useJsonViewerEditorStore.getState().text;
    const initialFormat = useJsonViewerStore.getState().sourceFormat;

    const state = EditorState.create({
      doc: initialText,
      extensions: buildExtensions(initialFormat, (next) => {
        // Chỉ propagate nếu khác ref → tránh loop với dispatch từ ngoài.
        if (next === lastSyncedTextRef.current) return;
        lastSyncedTextRef.current = next;
        setText(next);
      }),
    });

    const view = new EditorView({
      state,
      parent: hostRef.current,
    });
    viewRef.current = view;
    lastSyncedTextRef.current = initialText;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === Sync text từ store xuống CM khi đổi từ ngoài (Reset / Import / FormatChange) ===
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (text === current) return;
    // Update ref TRƯỚC khi dispatch để updateListener bỏ qua (so sánh ===).
    lastSyncedTextRef.current = text;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: text },
    });
  }, [text]);

  // === Reconfigure language khi đổi format ===
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartment.reconfigure(getLanguageExtension(sourceFormat)),
    });
  }, [sourceFormat]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            {sourceFormat}
          </span>
          <span className="truncate text-xs text-muted-foreground" title={filename}>
            · {filename}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
            {formatSize(text.length)}
          </span>
          {parsing && (
            <div
              className="h-3 w-3 shrink-0 animate-spin border-2 border-primary border-b-primary/30 border-r-primary/30"
              aria-label="Đang parse..."
              title="Đang parse..."
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <IOPanel />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditorOpen(false)}
            className="h-8 w-8 p-0"
            title="Đóng editor"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error && (
        <div
          className="border-b border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive"
          title={error}
        >
          {error}
        </div>
      )}

      {/* CodeMirror container — view tự attach DOM con khi mount. */}
      <div
        ref={hostRef}
        className={cn(
          'relative flex-1 overflow-hidden bg-background',
          error && 'bg-destructive/5'
        )}
      />
    </div>
  );
}