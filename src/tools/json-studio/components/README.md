# `components/json-studio/` — JSON Studio UI

UI cho route `/json-studio`. Visualize JSON, CSV, YAML, XML bằng 2 chế độ: **Graph** (Reaflow + ELK) hoặc **Tree** (pure React, lightweight).

**Rename note**: folder cũ `components/json-viewer/` đã rename sang `components/json-studio/` khi tool rebrand từ `json-viewer` sang `json-studio` (Phase 1 shell — spec `.kiro/specs/json-studio-shell/`).

## Convention

- Component nặng (`GraphView`) chỉ mount khi tab Graph được chọn để né cost ELK + reaflow nếu user chỉ dùng Tree.
- Code Graph (`GraphView`, `CustomNode`, `CustomEdge`, `ObjectNode`, `TextNode`, `TextRenderer`, `Controls`) extract từ [jsoncrack-react](https://github.com/AykutSarac/jsoncrack.com) (Apache 2.0). Giữ nguyên cấu trúc + tên file để dễ pull update từ upstream.
- CSS dùng CSS Modules. Theme tokens map sang CSS variables (`--node-fill`, `--node-key`...) trong `canvasHelpers.buildCanvasStyle`.
- Đừng hard-code màu trong Graph nodes — đi qua CSS vars.

## File

| File | Vai trò |
|---|---|
| `GraphView.tsx` | Reaflow canvas + zoom/pan + collapse. Forward ref expose viewport API. |
| `NodeDetailsDialog.tsx` | Dialog hiển thị Content + JSON Path khi click node (port từ jsoncrack `NodeModal.tsx`). |
| `DownloadImageDialog.tsx` | Dialog Download Image: filename + PNG/JPEG/SVG + background color + Clipboard / Download (port từ jsoncrack Download Image modal). |
| `TreeView.tsx` | Recursive tree viewer, default expand 2 levels. Lightweight pure React. |
| `DataEditor.tsx` | **CodeMirror 6** editor — line numbers, code folding, syntax highlight, bracket match, search (Ctrl+F), undo/redo. Bridge sang `editorStore.text` qua `updateListener`. |
| `IOPanel.tsx` | 2 dropdown: **File** (Import / Export) + **Format** (JSON / CSV / YAML / XML). Format dropdown convert text giữa các format qua object trung gian. |
| `GraphToolbar.tsx` | Overlay toolbar bottom-center: Root / Fit / Zoom / Export PNG / Search / Rotate / Collapse all / Preferences. |
| `PreferencesMenu.tsx` | Popover: Light mode, Zoom on scroll, Ruler. Persist localStorage. |
| `Controls.tsx` | Built-in Reaflow controls (đã thay bằng GraphToolbar, giữ làm fallback nếu `showControls={true}`). |
| `CustomNode.tsx` | Reaflow Node wrapper, route sang `ObjectNode` / `TextNode`. |
| `CustomEdge.tsx` | Reaflow Edge wrapper, click → focus target node. |
| `ObjectNode.tsx` | Render rows trong object/array node (key + value + chevron). |
| `TextNode.tsx` | Render primitive node (string/number/bool/null). |
| `TextRenderer.tsx` | Linkify URL + render hex/rgb color swatch. |
| `nodeStyles.ts` | Map (type, value) → CSS var color cho text. |
| `*.module.css` | Style scoped per component. |

## State

- **`useJsonStudioStore`** (`stores/jsonStudioStore.ts`) — committed data (`rawData`), view mode, editor open. Graph/Tree subscribe state này.
- **`useJsonStudioEditorStore`** (`stores/jsonStudioEditorStore.ts`) — text textarea (`text`), parsing flag, error. Tách store để gõ KHÔNG trigger graph rebuild. Parse + commit sang store chính được debounce 400ms.
- **`useJsonStudioPrefsStore`** (`stores/jsonStudioPrefsStore.ts`) — preferences persist localStorage (graphTheme, zoomOnScroll, showRuler). Migration 1-time từ key cũ `bibo:json-viewer:prefs` → `bibo:json-studio:prefs`, xoá key cũ, set flag `bibo:json-studio:migrated-v1`.

### Editor persistence (sessionStorage)

`jsonStudioEditorStore` tự ghi `{ text, format, filename }` vào `sessionStorage` (key `jsonStudio.editor.v1`) mỗi keystroke với debounce **800ms** (lớn hơn parse debounce 400ms để parse luôn fire trước, không tranh tài nguyên trên 1 keystroke). Legacy key `jsonViewer.editor.v1` được migrate 1 lần sang key mới khi mount.

Khi store init (mount route lần đầu trong session):
1. Đọc sessionStorage. Có data → restore text + gọi `setData` đồng bộ để graph mount với data đúng từ đầu.
2. Không có → load sample data.

`Reset` clear sessionStorage để thật sự đưa về sample.

Lý do dùng sessionStorage (không phải localStorage):
- Scoped per tab — user mở tool ở 2 tab khác nhau không "leak" data sang nhau.
- Reload tab vẫn giữ → fit case dev paste JSON tạm rồi F5 fix layout.
- Đóng tab xóa hết → không tích lũy state cũ.

## Doc liên quan

- **[docs/json-studio-performance.md](../../../docs/json-studio-performance.md)** — pattern + lessons performance.
- **[src/lib/json-studio/README.md](../../lib/json-studio/README.md)** — parser, theme, canvas helpers.

## Editor (CodeMirror 6)

`DataEditor` dùng [CodeMirror 6](https://codemirror.net/) thay cho textarea native (đã xóa `useTextareaLineShortcuts` cũ). Setup ở [`lib/json-studio/codemirror-setup.ts`](../../lib/json-studio/codemirror-setup.ts).

### Feature có sẵn từ CodeMirror

- Line numbers + active line highlight.
- Code folding (`{}`, `[]`, XML tag, YAML block) qua `foldGutter`.
- Syntax highlight cho JSON / YAML / XML qua language pack tương ứng. CSV không có lang pack — fallback plain text.
- Bracket matching, auto close brackets, indent on input.
- Search panel (Ctrl/Cmd + F), undo/redo (Ctrl/Cmd + Z/Y).
- Default keymap VSCode-like + `indentWithTab` (Tab indent / Shift+Tab outdent).
- Multi-cursor + rectangular selection (Alt + drag).

### Bridge React ↔ CodeMirror

- `EditorView.updateListener` → setText khi user gõ. So sánh ref `lastSyncedTextRef` để né update loop khi store dispatch ngược xuống.
- `languageCompartment.reconfigure(...)` để switch language khi đổi format — không destroy view (giữ history, scroll, selection).
- Khi store text đổi từ ngoài (Reset / Import / Format switch), `useEffect([text])` dispatch `changes: replace entire doc`.

### Bundle size

CodeMirror 6 cherry-pick (không import `basicSetup`):
- `state` + `view` + `commands` + `history` + `search` + `autocomplete` ~80KB gzipped.
- `lang-json` + `lang-yaml` + `lang-xml` + `@lezer/highlight` ~50KB gzipped.

Tổng tăng ~130KB gzipped trên route `/json-studio` chunk so với textarea + regex tokenizer trước đó.

## Node details dialog — port từ jsoncrack `NodeModal`

Click vào node trong graph → mở `NodeDetailsDialog` hiển thị **Content** (object hoá từ rows trong node) + **JSON Path** (`$[0]["contents"][3]`).

### Port khác bản gốc thế nào

| Aspect | jsoncrack (Mantine) | hubibo |
|---|---|---|
| Modal | `@mantine/core` Modal | shadcn `Dialog` |
| Syntax highlight | `@mantine/code-highlight` + Shiki + WASM | regex 1-pass ở `lib/json-studio/json-highlight.ts` |
| Copy button | `CodeHighlight withCopyButton` | nút riêng + `navigator.clipboard` + sonner toast |
| Palette | Shiki dark default | hard-code 5 màu Tomorrow Night Bright khớp screenshot jsoncrack |

Lý do **không** dùng Shiki ở hubibo:
- Shiki + WASM ~2MB → quá nặng cho 1 modal hiếm khi mở.
- Chỉ cần highlight JSON với 5 token type (key/string/number/bool-null/punct). Regex 1-pass đủ.

### Cách reuse pattern cho code block khác trong tool

Nếu cần highlight JSON ở chỗ khác (Tree value, IO panel preview...):

1. Dùng `highlightJson` từ [`lib/json-studio/json-highlight.ts`](../../lib/json-studio/json-highlight.ts) — đã extract sẵn `tokenize` + `JSON_HIGHLIGHT_COLORS`.
2. Render qua `<code dangerouslySetInnerHTML={{ __html: highlightJson(text) }} />` trong `<pre className="font-mono text-xs">`.
3. **KHÔNG** dùng CSS vars `--node-key/--node-value`: các vars này chỉ live trong wrapper của `GraphView` (set bằng `buildCanvasStyle`). Code block render trong Radix Portal/khác layer sẽ resolve `inherit` → 1 màu duy nhất. Color phải inline trong span style (đó là cách `json-highlight.ts` đang làm).

### Khi muốn đổi palette

Sửa `JSON_HIGHLIGHT_COLORS` trong `lib/json-studio/json-highlight.ts`. 5 token type:

- `punct` — dấu phẩy, ngoặc, whitespace
- `key` — string đứng trước `:`
- `string` — string value
- `number` — số
- `literal` — `true` / `false` / `null`

Palette CodeMirror trong `codemirror-setup.ts` (`const C`) cũng đồng bộ palette này để editor + modal nhìn thống nhất.

## Download Image — port từ jsoncrack "Download Image" modal

Click nút **Image** trên toolbar → mở `DownloadImageDialog` với options:

- **File Name** — không cần extension, hook tự thêm
- **Format** — PNG / JPEG / SVG
- **Background Color** — color picker (`<input type="color">`) + 18 preset swatches + ô `transparent` (checker pattern). Hỗ trợ paste hex code thẳng vào input.
- **Clipboard** — copy ảnh vào clipboard (chỉ PNG có ảnh + SVG có text; JPEG disable)
- **Download** — lưu file

Logic export ở [`exportGraphAsImage`](../../lib/json-studio/canvasHelpers.ts) — dùng [`html-to-image`](https://github.com/bubkoo/html-to-image) `1.11.11` (cùng version + lib mà jsoncrack dùng).

Lý do dùng `html-to-image` thay vì self-roll clone-SVG + canvas:
- Reaflow render text trong node bằng `<foreignObject>` chứa `<span>` HTML. Cách clone SVG rồi `drawImage` lên canvas **fail** với foreignObject → output trống chữ.
- `html-to-image` walk DOM + inline CSS + serialize chuẩn, xử lý foreignObject đúng.
- `skipFonts: true` để không try-fetch CSS @font-face từ Google Fonts (CORS), render bằng font đã load sẵn.

| Format | Pipeline | Clipboard |
|---|---|---|
| PNG | `toPng()` → data URI download | `toBlob()` → `ClipboardItem({ 'image/png': blob })` |
| JPEG | `toJpeg()` → data URI download | fallback PNG cho clipboard |
| SVG | `toSvg()` → data URI download | fallback PNG cho clipboard |

Target element export là `.jsoncrack-canvas` (wrapper Reaflow), không phải SVG con — preserve mọi style + foreignObject.

Gotcha:
- `pixelRatio` bump min 2 cho Hi-DPI output rõ trên Retina.
- `backgroundColor: undefined` (không truyền) khi user chọn `transparent` → giữ alpha (PNG/SVG).
- `ClipboardItem` chỉ hỗ trợ `image/png` ở major browsers → clipboard luôn dùng `toBlob` (PNG) bất kể format download.