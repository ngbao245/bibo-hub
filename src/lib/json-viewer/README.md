# `lib/json-viewer/` — JSON / CSV / YAML / XML Viewer logic

Pure utilities cho tool `/json-viewer`. Không touch React (trừ `CollapseContext` là context object). Tách ra khỏi components để dễ test + reuse.

## Convention

- Code parser + canvasHelpers + theme + CollapseContext extract từ [jsoncrack-react](https://github.com/AykutSarac/jsoncrack.com) (Apache 2.0). Giữ nguyên signature để dễ sync upstream nếu cần.
- `formats/` + `export-formatter.ts` + `parser-client.ts` + `parser.worker.ts` + `cache-maintenance.ts` là code mới của hubibo.

## File

| File | Vai trò |
|---|---|
| `parser.ts` | `parseGraph(json: string)` → `{ nodes, edges, errors }`. Dùng `jsonc-parser` để traverse, build graph nodes/edges. |
| `canvasHelpers.ts` | Logic geometry + zoom + animation hint cho `GraphView`. |
| `calculateNodeSize.ts` | Đo width/height cho node bằng off-DOM measurement (có TTL cache 120s + `clearNodeSizeCache`). |
| `theme.ts` | Light / dark token cho graph canvas (map ra CSS variables ở `buildCanvasStyle`). |
| `CollapseContext.ts` | React context + helpers cho collapse state. |
| `JSONCrackStyles.module.css` | Wrapper class cho `GraphView`. |
| `formats/index.ts` | Facade: `parseByFormat`, `stringifyByFormat`, `detectFormat`, `formatFromFilename`, `FORMAT_META`, `ALL_FORMATS`. |
| `formats/json.ts` | JSON parse/stringify native. |
| `formats/csv.ts` | `parseCsv` / `stringifyCsv` qua PapaParse. |
| `formats/yaml.ts` | YAML parse/stringify qua `yaml` (dynamic import). |
| `formats/xml.ts` | XML parse/stringify qua `fast-xml-parser` (dynamic import). Convention `@_attr` + `#text`. |
| `export-formatter.ts` | `downloadFile` (blob → trigger browser download) + `getDefaultFilename` (filename theo format). Stringify IOPanel gọi trực tiếp `stringifyByFormat`. |
| `parser-client.ts` | Async parser facade. Text < 50KB → inline. ≥ 50KB → worker. Export `parseAsync` + `terminateParserWorker` (cho `cache-maintenance`). |
| `parser.worker.ts` | Web Worker chạy parse off main thread, dùng cùng `parseByFormat` facade. |
| `cache-maintenance.ts` | `clearJsonViewerCaches()` — gọi khi rời route để free RAM. |
| `codemirror-setup.ts` | Build extensions + theme + language compartment cho CodeMirror 6 editor. |
| `json-highlight.ts` | Regex JSON highlighter cho `NodeDetailsDialog`. Không dùng cho editor (đã chuyển CM6). |
| `types.ts` | `NodeData`, `EdgeData`, `GraphData`, `LayoutDirection`, `CanvasThemeMode`, `SourceFormat` (`json` \| `csv` \| `yaml` \| `xml`), `ViewMode`. |

## Format conversion — lossy

Convert giữa 4 format luôn đi qua object trung gian. Lưu ý mất mát:

| Convert | Mất gì |
|---|---|
| YAML → JSON → YAML | Comment YAML mất. |
| XML → JSON → XML | Attribute order, namespace, CDATA marker. Round-trip OK với attribute thường (prefix `@_`). |
| Array → XML → Array | Wrap thêm `<root><item>...</item></root>` → ngược lại có root thừa. |
| JSON object lồng → CSV | Fail (CSV cần array of objects flat). UI bắn toast cảnh báo. |

Mục tiêu: viewer tiện chuyển format, KHÔNG phải editor preserving 100% structure. User cần round-trip XML chuẩn nên dùng lib chuyên dụng.

## Dependencies

- `jsonc-parser` — JSON parsing với recovery cho input có lỗi.
- `reaflow` (5.4.1) — Canvas + ELK layout. Pin version vì breaking change ở 6.x.
- `react-zoomable-ui` — Zoom/pan viewport.
- `use-long-press` — Touch drag canvas.
- `papaparse` — CSV parse/stringify.
- `yaml` (lazy-loaded) — YAML 1.2 parse/stringify.
- `fast-xml-parser` (lazy-loaded) — XML parse/build, ~15KB gzip.
- `@codemirror/*` — CodeMirror 6 modular editor (state/view/commands/history/search/autocomplete/language + `lang-json` / `lang-yaml` / `lang-xml`).

## Performance notes

Xem chi tiết: **[docs/json-viewer-performance.md](../../../docs/json-viewer-performance.md)**.

Tóm tắt:

1. **Parse debounce 400ms** ở `jsonViewerEditorStore`. ELK chỉ chạy sau 400ms im lặng.
2. **2 store tách biệt** — `editorStore.text` (sync mỗi keystroke) vs `viewerStore.rawData` (committed).
3. **Worker** — text ≥ 50KB parse off-thread. Worker bundle lazy import YAML/XML khi gặp format đó (không bloat worker startup).
4. **Worker format ES** trong `vite.config.ts` — cần thiết khi worker có dynamic import (code-splitting).
5. **GPU compositing hints** ở `JSONCrackStyles.module.css`.
6. **`maxRenderableNodes: 800`** — vượt → hiện overlay.

## Doc liên quan

- **[docs/json-viewer-performance.md](../../../docs/json-viewer-performance.md)** — performance patterns.
- **[src/components/json-viewer/README.md](../../components/json-viewer/README.md)** — components dùng helpers.