# JSON Viewer — Performance Patterns

Doc này note lại các pattern + lesson learned khi tune performance cho tool `/json-viewer`. Đặc biệt với JSON lớn (>100KB) và case user paste / select-all / paste liên tục.

## Vấn đề gặp phải

Tool dùng `reaflow` + ELK layout engine để render JSON thành graph. ELK chạy trên **main thread**, blocking khi tính layout cho graph >300 nodes.

Test case gây lag:
1. Paste JSON 163KB vào textarea
2. Select all
3. Paste JSON khác
4. Lặp 5-10 lần

Mỗi paste trước đây trigger ngay:
- `JSON.parse` (~50-200ms)
- `parseGraph` traverse (~50-100ms)
- `setData` → React commit → ELK layout (~500ms-2s)
- Reaflow mount nodes + framer-motion init (~200-500ms)

→ Lần thứ 5 user thấy UI freeze ~5-10 giây.

## Giải pháp đã thử (KHÔNG hiệu quả)

### ❌ Force remount qua `key={dataVersion}`

Ý tưởng: mỗi `setData` bump version → React key đổi → unmount + mount Canvas mới → drop internal state cũ.

**Vấn đề**: reaflow + framer-motion + react-zoomable-ui đăng ký document-level listeners, internal refs, animation queues. Cleanup không hoàn hảo → instance cũ vẫn ref → GC không thu hồi được. Càng remount càng leak.

### ❌ 2-step null-render giữa unmount + mount

Render `null` 2 frames + 30ms timeout giữa unmount cũ và mount mới, kỳ vọng GC thu hồi.

**Vấn đề**: vẫn không giải quyết, chỉ delay vấn đề. Listeners global vẫn captured trong closures.

### ❌ Terminate parser worker mỗi setData

Reject pending Promise + drop singleton. Mỗi lần parse tạo worker mới.

**Vấn đề**: chu kỳ terminate-recreate-terminate gây fragmentation memory. Pending promise reject để lại trace closure.

### ❌ Web Worker để parse off-thread

Đẩy `JSON.parse` sang worker để không block main thread khi gõ.

**Vấn đề**: parse JSON không phải bottleneck. Chỉ ~50-200ms cho 163KB. **ELK layout mới là bottleneck** (~1-2s). Worker giải quyết sai vấn đề.

## Giải pháp THẬT SỰ hiệu quả (theo JSON Crack)

Đọc source `jsoncrack.com/apps/www/src/store/useFile.ts` (external repo Kiro clone-local để reference, KHÔNG commit vào workspace):

```ts
const debouncedUpdateJson = debounce((value: unknown) => {
  useJson.getState().setJson(JSON.stringify(value, null, 2));
}, 400);
```

JSON Crack tách **2 store**:
- `useFile.contents` — text editor (update mỗi keystroke từ Monaco onChange)
- `useJson.json` — version đã commit cho Graph (debounced 400ms qua `lodash.debounce`)

Graph view chỉ subscribe `useJson.json` → mỗi 400ms im lặng mới rebuild 1 lần.

### Áp dụng vào hubibo

**2 store tách biệt:**

```ts
// src/stores/jsonViewerEditorStore.ts
//   - text: string (update mỗi keystroke từ textarea)
//   - parsing: boolean (cho spinner indicator)
//   - error: string | null
//   - setText(): schedule commit debounced

// src/stores/jsonViewerStore.ts
//   - rawData: unknown (Graph/Tree subscribe state này)
//   - dataVersion: number (cho components cần signal "data đổi")
//   - setData(): caller (commit) gọi
```

**Debounce ở store level:**

```ts
// src/stores/jsonViewerEditorStore.ts
function scheduleCommit(text: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  setState({ parsing: true });
  debounceTimer = setTimeout(() => commitNow(text), 400);
}
```

Mỗi `setText` clears previous timer → user paste 10 lần liên tiếp = **chỉ 1 lần parse + commit** (lần cuối, sau khi user dừng 400ms).

## Pattern conventions

### 1. State scope đúng cấp

| Loại state | Store | Update tần suất |
|---|---|---|
| Text editor | `jsonViewerEditorStore` | Mỗi keystroke (sync) |
| Committed data (cho view) | `jsonViewerStore` | Debounced 400ms |
| Preferences (theme, ruler...) | `jsonViewerPrefsStore` | Khi user toggle (rare) |

→ Subscribe đúng store thì component không re-render thừa.

### 2. GPU compositing cho camera animation

`src/lib/json-viewer/JSONCrackStyles.module.css`:

```css
.canvasWrapper :global(.jsoncrack-space) {
  cursor: url('/cursor-grab.svg') 10 10, grab;
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}
.canvasWrapper :global(.jsoncrack-canvas) {
  will-change: transform;
  transform: translateZ(0);
}
.canvasWrapper :global(.jsoncrack-canvas g[data-id]) {
  contain: layout paint;
}
```

Đẩy camera transform lên GPU layer riêng → pan/zoom mượt 60fps không phụ thuộc main thread (ELK vẫn có thể chạy ngầm).

### 3. SVG attribute thay vì CSS

Hubibo có `borderRadius: 0` cứng trên Tailwind config toàn app. Để graph nodes vẫn có border-radius:

```css
.canvasWrapper :global(rect) {
  rx: 4;
  ry: 4;
  filter: drop-shadow(2px 2px 0 var(--node-shadow));
}
```

SVG `rx`/`ry` attributes bypass Tailwind, drop-shadow trên SVG → GPU compositing tốt.

### 4. Cursor SVG custom

```css
cursor: url('/cursor-grab.svg') 10 10, grab;
```

SVG cursor không trigger repaint khi mouse di chuyển (như cursor emoji). Mượt hơn `cursor: grab` native trên Linux/Mac.

### 5. Loading state qua CSS class

Khi ELK đang chạy, **không spinner** (spinner xoay sẽ giật vì cạnh tranh CPU với ELK). Thay vào đó toggle class `.processing` lên container → ẩn diagram + grid:

```css
.canvasWrapper.processing.showGrid {
  background-image: none;
}
.canvasWrapper.processing :global(.jsoncrack-space) {
  opacity: 0;
  pointer-events: none;
}
```

User thấy nền dark đồng nhất → 1 lần "tất cả cùng hiện" → không có frame trung gian giật.

### 6. Cleanup khi rời route

```tsx
// JsonViewer.tsx
useEffect(() => {
  return () => clearJsonViewerCaches();
}, []);
```

`clearJsonViewerCaches()`:
- Terminate parser worker (~30MB RAM)
- Clear node-size measurement cache (Map có thể phình to với graph lớn)

→ User vào tool → ra tool → RAM trả về như trước.

## Pitfalls tránh

### ❌ Đừng dùng `key={dataVersion}` để force remount Canvas

Lý do trong section "Giải pháp đã thử". Reaflow + framer-motion + react-zoomable-ui đăng ký global listeners, cleanup không hoàn hảo → leak tích lũy.

JSON Crack chỉ dùng `key` cho `direction/gestures/rulers` (config UI), KHÔNG cho data. Hubibo cũng nên vậy.

### ❌ Đừng terminate worker giữa các lần parse

Worker singleton lazy-init. Chu kỳ terminate-recreate gây fragmentation. Chỉ terminate khi rời route.

### ❌ Đừng auto-parse mỗi keystroke

Parse chỉ chạy sau debounce 400ms (qua editorStore). Sync setState text + sync setState rawData = 2 lần re-render cho Graph mỗi keystroke = chết.

### ❌ Đừng spinner overlay với `backdrop-filter: blur(...)`

Backdrop-filter full-screen tốn CPU mỗi frame. Cạnh tranh với ELK → spinner giật.

## Bundle size

Lazy route `/json-viewer`, chunk ~2.6MB (gzip ~840KB). Heavy deps:
- `reaflow` + framer-motion: ~500KB
- ELK `elk.bundled.js`: 1.4MB (lazy chunk riêng, chỉ load khi cần graph)
- `papaparse`: ~50KB
- `react-zoomable-ui`: ~80KB

Initial app bundle KHÔNG bị ảnh hưởng. Worker chunk: 20KB.

## Verify checklist

- [ ] Paste JSON 100KB+ vào textarea → UI không freeze khi gõ
- [ ] Select all + paste khác nhau 10 lần liên tiếp → vẫn mượt (không lag tích lũy)
- [ ] Spinner trong header editor xoay đều khi parse (không giật frame)
- [ ] Camera pan/zoom 60fps cho graph 500+ nodes
- [ ] Vào tool → ra → vào lại → RAM không phình
- [ ] `npm run build` chunk `/json-viewer` không quá to (~2.6MB raw OK)

## Reference

- JSON Crack `apps/www/src/store/useFile.ts` — pattern debounce gốc (external repo, không có trong workspace)
- JSON Crack `apps/www/src/features/editor/views/GraphView/index.tsx` — key cho config, không cho data (external repo)
- [ELK Layered](https://eclipse.dev/elk/) — layout algorithm reaflow dùng