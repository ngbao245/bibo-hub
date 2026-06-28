# PDF Reader

PDF viewer với highlight, theme switching, và text selection.

## Features

### 📖 Core Reading
- **PDF rendering** với react-pdf (pdfjs-dist)
- **Page navigation**: Previous/Next buttons, keyboard arrows (←/→)
- **Jump to page**: Click page counter để nhập số trang
- **Zoom controls**: ±10% per click, range 50-300%
- **Progress tracking**: Auto-save page hiện tại, restore khi mở lại

### 🎨 Themes
- **Light**: Màu gốc PDF
- **Sepia**: Vàng nhạt, dễ đọc ban đêm
- **Dark**: Invert colors, nền đen chữ trắng

**Implementation:**
- CSS `filter: invert() hue-rotate()` apply lên `.react-pdf__Page`
- Canvas và text layer cùng transform → không bị lệch
- Background color thay đổi theo theme

### ✨ Text Selection & Highlights
- **Text layer**: Transparent overlay để enable selection
- **Selection Mask**: Block header/footer PDF (adjustable top/bottom %)
- **Highlight**: Yellow marker cho text quan trọng
- **Note**: Blue marker + text note
- **Translate**: (Feature placeholder)

**Text Layer Alignment Fix:**
```css
/* Apply filter lên parent để canvas + text layer sync */
[data-pdf-theme='dark'] .react-pdf__Page {
  filter: invert(1) hue-rotate(180deg);
}

/* Force exact positioning */
.react-pdf__Page__textContent {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  transform: translateZ(0); /* Hardware acceleration */
}
```

### 📱 Mobile Optimizations
- **Compact header**: Chỉ prev/next + page counter + settings
- **Settings dropdown**: Gộp zoom, theme, selection mask
- **Clickable page counter**: Tap "12/301" → input box → nhập số → Enter
- **Hide book title**: Ẩn trên màn hình < 640px
- **Edge click zones**: Click 8% trái/phải màn hình để lật trang

### 🎯 Edge Click Zones
- **Width**: 8% viewport, min 48px
- **Position**: Absolute, fixed theo viewport (không scroll theo PDF)
- **Hover**: Hiện chevron icon mờ
- **Mobile**: Luôn clickable (không dùng `pointer-events-none`)
- **Left zone**: Shift right khi sidebar open

## Component Structure

```
PdfReader/
├── ReaderHeader          # Title + controls
├── ProgressBar          # Page progress indicator
├── EdgeClickZones       # Left/Right click areas
├── ReaderSidebar        # TOC + Highlights + Search
│   ├── TocList
│   ├── HighlightList
│   └── PdfSearchTab
├── SelectionMenu        # Highlight/Note/Translate popup
├── TranslatePopover     # Translation UI
├── SettingsDropdown     # Mobile settings menu (NEW)
└── react-pdf Document
    ├── Page             # PDF page canvas + text layer
    ├── HighlightOverlay # Yellow/Blue markers
    └── SelectionMaskOverlay # Block header/footer
```

## State Management

### Local State
```typescript
const [pageNumber, setPageNumber] = useState(1);
const [numPages, setNumPages] = useState(0);
const [scale, setScale] = useState(1.2); // localStorage
const [theme, setTheme] = useState<'light'|'sepia'|'dark'>('light'); // localStorage
const [selectionMask, setSelectionMask] = useState({
  top: 5,      // % from top
  bottom: 5,   // % from bottom
  enabled: false
}); // localStorage
const [sidebarOpen, setSidebarOpen] = useState(false);
const [mobilePageInputOpen, setMobilePageInputOpen] = useState(false);
```

### React Query
```typescript
useProgress(bookId)        // GET progress
useSaveProgress()          // POST/PATCH progress
useHighlights(bookId)      // GET highlights
useCreateHighlight()       // POST highlight
```

## Performance Optimizations

### 1. Blob Cache (IndexedDB)
```typescript
// Cache miss: Stream từ server
const url = await getBookFileUrl(path);
setFileData({ kind: 'url', url });

// Cache hit: Load instant từ IndexedDB
const cached = await getCached(STORE_FILES, path);
const buffer = await cached.arrayBuffer();
setFileData({ kind: 'data', data: buffer });

// Background prefetch sau 3s
setTimeout(() => fetchThroughCache(...), 3000);
```

### 2. Page Prefetch
```typescript
// Pre-fetch trang kế cận để click next/prev instant
useEffect(() => {
  const targets = [pageNumber + 1, pageNumber - 1];
  for (const n of targets) {
    await pdfDoc.getPage(n); // Cache in pdfjs
  }
}, [pageNumber, numPages]);
```

### 3. Snapshot Canvas
```typescript
// Capture canvas trước khi lật trang → tránh flicker
const captureSnapshot = () => {
  const srcCanvas = wrap.querySelector('canvas');
  offscreenCanvas.getContext('2d').drawImage(srcCanvas, 0, 0);
  setSnapshotVisible(true);
};

// Clear sau khi trang mới render xong
<Page onRenderSuccess={clearSnapshot} />
```

### 4. Debounced Progress Save
```typescript
// Chỉ save 1 lần khi user dừng lật trang ~600ms
useEffect(() => {
  const timer = setTimeout(() => {
    saveProgress.mutate({ bookId, location: pageNumber, ... });
  }, 600);
  return () => clearTimeout(timer);
}, [pageNumber]);
```

## Selection Mask System

### Purpose
Block text selection ở header/footer PDF (page numbers, running headers).

### UI Controls
- **Toggle**: Eye icon (desktop) hoặc Settings > Selection Mask (mobile)
- **Top %**: Percentage từ đầu trang
- **Bottom %**: Percentage từ cuối trang
- **Show borders**: Hiện viền xanh khi focus input

### Implementation
```tsx
<SelectionMaskOverlay top={5} bottom={5} showBorders={false} />

// 2 div absolute với user-select: none
<div style={{ height: '5%', userSelect: 'none' }} 
     onMouseDown={(e) => e.preventDefault()} />
```

### Limitations
- ❌ Ctrl+A vẫn select được (keyboard event không block được)
- ✅ Mouse selection bị chặn hoàn toàn
- ✅ Vùng mask có `cursor: not-allowed`

## Mobile Header Layout

### Desktop (≥ 768px)
```
[☰] | [<] [input:12] / 301 [>] | [-] 120% [+] | [🌙] | [👁️] T:[5] B:[5]
```

### Mobile (< 768px)
```
[<] 12/301 [>] | [☰] [⚙️]
              ↑ Click → input
                        ↓ Dropdown
                    [Zoom: 120%]
                    [Theme: Dark]
                    [Mask: ON]
```

## CSS Filter Strategy

### Problem
Canvas bị `filter: invert()` nhưng text layer không → 2 layers lệch nhau.

### Solution
```css
/* Apply filter lên parent container */
[data-pdf-theme='dark'] .react-pdf__Page {
  filter: invert(1) hue-rotate(180deg);
}

/* Force text layer exact alignment */
.react-pdf__Page__textContent {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Hide text, keep selection */
.react-pdf__Page__textContent span {
  color: transparent !important;
  opacity: 0.0001;
}

.react-pdf__Page__textContent ::selection {
  background-color: rgba(100, 150, 255, 0.3);
  opacity: 1;
}
```

## Known Issues & Workarounds

### 1. Worker Path
PDF.js worker phải point đến CDN hoặc local copy:
```typescript
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();
```

### 2. Text Layer Misalignment
- ✅ Fixed bằng cách apply filter lên `.react-pdf__Page`
- ✅ Force positioning với `!important`
- ✅ Hardware acceleration với `translateZ(0)`

### 3. Snapshot Flicker
- ✅ Dùng offscreen canvas + `drawImage()` (không encode PNG)
- ✅ CSS-scale snapshot khi zoom để khớp size mới
- ✅ Auto cleanup sau 1.5s nếu `onRenderSuccess` không fire

### 4. Mobile Input Box
- Issue: Khi blur mà chưa nhập gì → cũng phải jump
- ✅ Fixed: Empty value → fallback về `pageNumber`
- ✅ Enter/Blur đều apply page change

## Future Improvements

- [ ] Keyboard shortcuts (J/K for prev/next)
- [ ] Fullscreen mode
- [ ] Two-page spread view
- [ ] Annotation tools (draw, arrow, box)
- [ ] Export highlights to markdown
- [ ] Search within PDF (full-text)
- [ ] Bookmarks/favorites
- [ ] Reading statistics (time spent, pages read)

## Related Files

- `src/components/reader/PdfReader.tsx` - Main component
- `src/components/reader/EdgeClickZones.tsx` - Pagination zones
- `src/components/reader/SettingsDropdown.tsx` - Mobile settings
- `src/components/reader/ReaderHeader.tsx` - Header component
- `src/styles/index.css` - PDF theme filters
- `src/api/reader/` - API hooks (books, progress, highlights)
- `src/lib/reader/blob-cache.ts` - IndexedDB caching