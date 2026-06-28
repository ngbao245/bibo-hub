import { create } from 'zustand';
import { useJsonViewerStore } from './jsonViewerStore';
import { detectFormat, parseByFormat } from '@/lib/json-viewer/formats';
import type { SourceFormat } from '@/lib/json-viewer/types';

// ============================================================
// Editor store - text trong textarea, parse debounced
// ============================================================
//
// Học từ JSON Crack pattern:
//   - useFile.contents = text editor (sync mỗi keystroke)
//   - useJson.json = đã commit cho graph (debounced 400ms)
//
// Tách store giúp:
//   - Textarea (controlled input) re-render mượt khi gõ — không trigger graph rebuild
//   - Graph subscribe rawData ở store khác, chỉ rebuild sau debounce
//   - Không có ELK chạy chồng lên ELK → không lag tích lũy
//
// PERSISTENCE — sessionStorage:
//   - Mỗi keystroke debounce 800ms → ghi text + format + filename vào sessionStorage
//   - Debounce 800ms (persist) > 400ms (parse) → parse luôn chạy trước.
//
// ASYNC PARSE:
//   - parseByFormat trả Promise (YAML/XML cần dynamic import).
//   - commitNow gắn 1 token cho request hiện tại; resolve cũ bị bỏ qua nếu
//     user gõ tiếp (token đã đổi).
// ============================================================

const PARSE_DEBOUNCE_MS = 400;
const PERSIST_DEBOUNCE_MS = 800;
const STORAGE_KEY = 'jsonViewer.editor.v1';

interface PersistedState {
  text: string;
  format: SourceFormat;
  filename: string;
}

interface EditorState {
  /** Text hiện tại trong textarea. Update mỗi keystroke. */
  text: string;
  /** Đang parse hay không (cho spinner indicator). */
  parsing: boolean;
  /** Lỗi parse gần nhất, null nếu OK. */
  error: string | null;

  setText: (next: string) => void;
  /** Sync text từ store data ngược lại textarea (vd sau Reset, Import file). */
  syncFromData: (text: string) => void;
}

let parseTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let commitToken = 0;

async function commitNow(text: string) {
  const myToken = ++commitToken;
  const trimmed = text.trim();
  if (!trimmed) {
    useJsonViewerEditorStore.setState({ parsing: false, error: null });
    return;
  }

  // Ưu tiên format đang chọn trong store; nếu user gõ format khác hẳn
  // (vd đang JSON gõ vào `<xml>`), detect lại để parse cho đúng.
  const storeFormat = useJsonViewerStore.getState().sourceFormat;
  let fmt: SourceFormat = storeFormat;
  try {
    // Thử parse format hiện tại trước. Nếu fail mới detect lại.
    await parseByFormat(trimmed, fmt);
  } catch {
    const detected = detectFormat(trimmed);
    if (detected) fmt = detected;
  }

  try {
    const data = await parseByFormat(trimmed, fmt);
    // Stale check sau await: user đã gõ tiếp → bỏ qua.
    if (myToken !== commitToken) return;

    const currentFilename = useJsonViewerStore.getState().sourceFilename;
    const currentFormat = useJsonViewerStore.getState().sourceFormat;
    useJsonViewerStore
      .getState()
      .setData(data, fmt, fmt === currentFormat ? currentFilename : `pasted.${fmt}`);
    useJsonViewerEditorStore.setState({ parsing: false, error: null });
  } catch (err) {
    if (myToken !== commitToken) return;
    useJsonViewerEditorStore.setState({
      parsing: false,
      error: err instanceof Error ? err.message : 'Parse error',
    });
  }
}

function scheduleParse(text: string) {
  if (parseTimer) clearTimeout(parseTimer);
  useJsonViewerEditorStore.setState({ parsing: true });
  parseTimer = setTimeout(() => {
    parseTimer = null;
    void commitNow(text);
  }, PARSE_DEBOUNCE_MS);
}

function schedulePersist(text: string) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const { sourceFormat, sourceFilename } = useJsonViewerStore.getState();
      const payload: PersistedState = {
        text,
        format: sourceFormat,
        filename: sourceFilename,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // QuotaExceeded / sessionStorage disabled → state vẫn live in-memory.
    }
  }, PERSIST_DEBOUNCE_MS);
}

function loadPersisted(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (typeof parsed?.text !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function getInitialText(): string {
  // Ưu tiên restore từ sessionStorage để user reload không mất state đang edit.
  const persisted = loadPersisted();
  if (persisted) {
    // Sync setData ngay với rawData hiện tại nhưng đổi format + filename —
    // graph mount với data tạm (SAMPLE_JSON) nhưng `sourceFormat` đã khớp
    // text persisted → highlight đúng từ first paint. Async parse phía dưới
    // sẽ update data thật.
    const store = useJsonViewerStore.getState();
    store.setData(store.rawData, persisted.format, persisted.filename);

    const trimmed = persisted.text.trim();
    if (trimmed) {
      // Parse async để restore data store đúng. Lib YAML/XML lazy-import.
      void parseByFormat(trimmed, persisted.format)
        .then((data) => {
          useJsonViewerStore.getState().setData(data, persisted.format, persisted.filename);
        })
        .catch(() => {
          // Persisted text đang parse-error. Text vẫn restore trong textarea;
          // user fix là parse lại theo debounce.
        });
    }
    return persisted.text;
  }

  const state = useJsonViewerStore.getState();
  const data = state.rawData;
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return '';
  }
}

export const useJsonViewerEditorStore = create<EditorState>(() => ({
  text: getInitialText(),
  parsing: false,
  error: null,

  setText: (next) => {
    useJsonViewerEditorStore.setState({ text: next });
    scheduleParse(next);
    schedulePersist(next);
  },

  syncFromData: (text) => {
    if (parseTimer) {
      clearTimeout(parseTimer);
      parseTimer = null;
    }
    // Invalidate request đang chạy (nếu có) — vì text mới sẽ thay
    // text cũ, kết quả parse cũ không còn relevant.
    commitToken++;
    useJsonViewerEditorStore.setState({ text, parsing: false, error: null });
    schedulePersist(text);
  },
}));