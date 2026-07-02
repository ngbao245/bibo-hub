# BiBo Reader Tool — Tổng Hợp Chức Năng

## Kiến Trúc Chung

**Stack:**
- UI: React 18 + Tailwind 3 + shadcn/ui (Radix)
- PDF Render: react-pdf v6 (pdfjs backend)
- State: Zustand (UI) + TanStack Query v5 (server)
- Routing: react-router-dom v6
- Storage: Supabase (auth + highlights + progress) + IndexedDB (blob cache)

**Entry Point:** `src/routes/reader/Reader.tsx` → route-level wrapper
- Query book metadata từ API
- Render `<PdfReader book={bookData} />` vào main component

---

## 1. PDF Rendering & Performance

### File: `src/components/reader/PdfReader.tsx` (main component, ~1000 LOC)

**Trách nhiệm chính:**
- Load PDF từ IndexedDB cache (hit instant) hoặc từ URL (streaming)
- Render page via `<Document>` / `<Page>` react-pdf wrapper
- Manage state: page number, zoom, theme, selection, highlights, progress
- Persist user settings (zoom, theme, selection mask) vào localStorage

**Key Features:**

#### A. Caching Strategy (Dual Mode)
```
Load PDF:
  1. Check IndexedDB (STORE_FILES, key=book.file_path)
    → Đã cache: load instant ArrayBuffer → render ngay
    → Miss: stream từ URL, listen onLoadProgress, render while downloading
  2. Background prefetch (3s sau render, nếu streaming):
     → Fetch full file + cache vào IndexedDB để lần sau instant
```

**Code:**
- `useEffect` line 149-177: file load logic
- `fetchThroughCache()` từ `blob-cache.ts`: cache manager
- `STORE_FILES` constant: IndexedDB store name

#### B. Canvas Snapshot (Anti-flicker)
Khi render trang mới, pdfjs canvas clear → blink nền. Fix:
- Capture canvas bitmap trước khi page re-render
- Vẽ bitmap lên offscreen canvas + append vào DOM (z-10)
- Khi new page render xong (onRenderSuccess) → clear snapshot

**Code:**
- `captureSnapshot()` line 407-430: copy canvas via drawImage (free, không encode)
- `clearSnapshot()` line 432-436: cleanup
- `snapshotRef` + `snapshotVisible`: state quản
- Trigger: `changePage()` (line 456), `changeScale()` (line 481)

#### C. Progress Tracking & Restoration
- Save current page sau 600ms debounce (prevent spam khi user lật nhanh)
- Restore page on mount từ API (khỏi refetch lúc queryInvalidate)
- Prefetch page kế cận (n±1) async để next/prev click instant

**Code:**
- `saveTimerRef` + useEffect line 265-279: debounce save progress
- `restoredRef` line 147: restore once flag (tránh feedback loop)
- Prefetch loop line 240-262

---

## 2. Text Selection & Highlighting

### File: `src/components/reader/SelectionMenu.tsx`

**Flow:**
1. User drag/select text trên PDF
2. `mouseup` / `touchend` listener (PdfReader line 349-358) → `captureSelection()`
3. Nếu selection valid (>= 2 ký tự):
   - Capture text + rects (normalized % of page)
   - Build menu position (prefer above, fallback below)
   - Show SelectionMenu floating menu với 3 action: Highlight / Note / Translate

**SelectionMenu Props:**
```ts
interface Props {
  rect: { top, left, width, height };        // Menu vị trí (viewport coords)
  onHighlight: () => void;
  onNote: () => void;
  onTranslate: () => void;
  onDismiss: () => void;
}
```

**Position Logic:**
- Calc menu size sau mount (useEffect)
- Prefer above selection → clamp vào viewport
- Horizontal center on selection, clamp left/right

### iOS Callout Bar Suppression

**Problem:** iOS Selection Callout (Copy/Look Up/Share) tồn tại khi có DOM Selection.
Kỳ vọng: ẩn menu iOS, nhưng vẫn có app menu.

**Solution (Implemented):**
1. Capture selection rects + text vào state (SelectionState)
2. Xóa native DOM Selection ngay (queueMicrotask để Safari kịp cleanup)
3. Vẽ overlay "fake selection" xanh nhạt (SelectionRectsOverlay) theo `rectsNorm`
4. Show app SelectionMenu bình thường

**Code:**
- `disableIosCallout` state (localStorage key: `reader_disable_ios_callout`)
- Toggle ở SettingsDropdown mục "Disable iOS Menu" (mobile only detection)
- `captureSelection()` line 294-346: clear range nếu flag bật
- `SelectionRectsOverlay()` component: vẽ fake selection (color: blue/0.35)

### Highlight Storage & Rendering

**Flow:**
1. User click "Highlight" → call `createHighlight` mutation (TanStack Query)
2. API: Save highlight (text, color, rects normalized, page, bookId)
3. Query refetch → `highlightsQuery.data` update
4. `pageHighlights` memo (line 281-286): filter highlight of current page
5. `HighlightOverlay` component: vẽ lên page (color: yellow/blue/green/red per user choice)

**Highlight Color Map:**
```ts
blue   → rgba(59, 130, 246, 0.35)   // Note
yellow → rgba(250, 204, 21, 0.35)   // Default highlight
green  → rgba(34, 197, 94, 0.35)
red    → rgba(239, 68, 68, 0.35)
```

**Highlight Data Shape:**
```ts
{
  id: string;
  bookId: string;
  location: { type: 'pdf'; page: number; rects: [{x,y,w,h}] };  // Normalized 0-1
  text: string;
  color: 'yellow' | 'blue' | 'green' | 'red';
  note?: string;
}
```

---

## 3. Selection Mask (Block Header/Footer)

### Purpose
PDF có page numbers, running headers tại top/bottom → khi user chọn text, mask block selection ở vùng đó.

### Usage
- SettingsDropdown mục "Selection Mask" → toggle ON/OFF
- Input fields: Top (%) + Bottom (%) để adjust vùng block
- Khi focus input → show border dashed xanh để visual feedback (showMaskBorders state)

**Code:**
- State: `selectionMask` (line 105-115), persist localStorage
- Component: `SelectionMaskOverlay` (line 853+): vẽ 2 div (top/bottom) với `user-select: none` + prevent mouse
- Integration: Render trong `<div>` wrapping `<Page>` (line 711-713)

---

## 4. Zoom & Theme

### Zoom
- Default: 1.2x (localStorage key: `reader_pdf_zoom`)
- Range: 0.5x – 3x (clamped ở `changeScale()` line 481-494)
- Action: Snapshot canvas trc zoom (tránh flicker), scale placeholder canvas ratio
- UI: Nút +/- ở desktop header; input ở desktop settings

### Theme
- 3 mode: light / sepia / dark (cycle via `cycleTheme()`)
- THEME_BG: CSS background color xung quanh page (line 50-54)
- PDF page content: không đổi (pdfjs render native), nhưng canvas overlay (snapshot) inherit CSS
- CSS filter apply PDF page (data-pdf-theme attr): còn pending (chưa implement filter)

**Code:**
- `theme` state + THEME_ORDER array (line 43)
- Keyboard shortcut "T" để cycle (line 498, commented out)
- SettingsDropdown: theme button show icon + label

---

## 5. Navigation

### Page Changing
- `changePage(updater)` (line 456-473): setState + snapshot canvas trước zoom
- Keyboard: Arrow Left/Right (line 496-503, listens doc.keydown globally)
- Header buttons: Prev/Next nút chevron (mobile + desktop)
- Page input: Mobile input dialog / Desktop inline input
- Edge click zones: Invisible zones 2 cạnh page (click → prev/next), component `EdgeClickZones` separate

### Page Navigation Buttons Toggle
- State: `showPageNavButtons` (default ON, localStorage: `reader_show_page_nav`)
- Control: SettingsDropdown toggle "Nút lật trang"
- Effect: Hide/show chevron buttons ở cả mobile + desktop header
- Edge zones: Luôn active (không bị ảnh hưởng)

---

## 6. Settings & UI Components

### SettingsDropdown (`src/components/reader/SettingsDropdown.tsx`)

**Sections (conditional):**
1. **Zoom** (desktop only, optional)
   - -/+ buttons, display percent
2. **Theme** (all)
   - Button cycle: Dark → Sepia → Light
3. **Page Navigation Buttons Toggle** (all)
   - ON/OFF toggle, default ON
4. **Selection Mask** (all)
   - Toggle + conditional Top/Bottom % inputs
5. **Disable iOS Menu** (mobile/touch only, if `'ontouchstart' in window`)
   - ON/OFF toggle

**Header Toolbar Layout:**

**Mobile (`md:hidden`):**
- [Chevron Prev] [Page Input] [Chevron Next] [Sidebar Menu] [Settings Dropdown]

**Desktop (`hidden md:flex`):**
- [Chevron Prev] [Page Input] / [NumPages] [Chevron Next] [Zoom -] [Zoom %] [Zoom +] [Theme] [Selection Mask] [Mask T/B inputs] [Settings Dropdown]

---

## 7. Sidebar & Search

### ReaderSidebar (`src/components/reader/ReaderSidebar.tsx`)
- Toggle via menu button (header)
- 3 tabs:
  1. **TOC**: Table of contents (lazy built from PDF outline on load)
  2. **Highlights**: List saved highlights per book
  3. **Search**: Full-text search

### PDF Search (`src/lib/reader/pdf-search.ts`)

**Lazy Index Strategy:**
- On first search: iterate all pages, call `getTextContent()`, build text cache
- Cache stored in WeakMap (keyed by PDFDocumentProxy)
- 500-page book ~50ms to build

**`searchPdf(doc, query, opts): Promise<PdfSearchMatch[]>`**
- Query min 2 chars
- Case-sensitive optional
- Return matches with preview (40 chars context) + highlight positions
- Limit: default 100 matches

---

## 8. Data Models

### Book Type (from API)
```ts
{
  id: string;
  title: string;
  file_path: string;        // Path to PDF blob in storage (for cache key)
  cover_url?: string;
  // ... other fields
}
```

### Highlight Type (stored in DB)
```ts
{
  id: string;
  bookId: string;
  text: string;
  color: 'yellow' | 'blue' | 'green' | 'red';
  note?: string;
  location: {
    type: 'pdf';
    page: number;           // 1-based
    rects: Array<{          // Normalized to [0, 1]
      x: number;
      y: number;
      w: number;
      h: number;
    }>;
  };
  createdAt?: ISO string;
}
```

### Progress Type (stored in DB)
```ts
{
  bookId: string;
  userId: string;
  location: string;         // Page number as string (for simplicity)
  progress: number;         // 0–1 (page / numPages)
  lastReadAt?: ISO string;
}
```

---

## 9. LocalStorage Keys

| Key | Type | Default | Purpose |
|---|---|---|---|
| `reader_pdf_zoom` | string (number) | "1.2" | Saved zoom level |
| `reader_pdf_theme` | string | "light" | Saved theme |
| `reader_selection_mask` | string (JSON) | `{top:5,bottom:5,enabled:false}` | Selection mask settings |
| `reader_disable_ios_callout` | string ("true"/"false") | "false" | iOS callout suppression |
| `reader_show_page_nav` | string ("true"/"false") | "true" | Show/hide page nav buttons |

---

## 10. Common Patterns & Edge Cases

### Pattern: Ref Mirror for useCallback
Problem: Need to access latest state inside callback without adding to deps.
Solution:
```ts
const [disableIosCallout, setDisableIosCallout] = useState(...);
const disableIosCalloutRef = useRef(disableIosCallout);
useEffect(() => {
  disableIosCalloutRef.current = disableIosCallout;
}, [disableIosCallout]);

// Now use disableIosCalloutRef.current inside captureSelection callback
```

### Pattern: Debounce Save
Prevent saving progress on every page change:
```ts
const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  saveTimerRef.current = setTimeout(() => {
    saveProgress.mutate({...});
  }, 600);
  return () => clearTimeout(saveTimerRef.current);
}, [pageNumber, numPages]);
```

### Pattern: Canvas Snapshot
Avoid flicker during re-render:
```ts
const captureSnapshot = () => {
  const src = wrap.querySelector('canvas.react-pdf__Page__canvas');
  const off = document.createElement('canvas');
  off.getContext('2d').drawImage(src, 0, 0);
  wrap.appendChild(off);
};
```

### Edge Case: PDF is Scan/Image-Only
- `getTextContent()` return empty items
- Search: no matches on that page
- Selection: no text can be selected (pdfjs doesn't expose text layer)

---

## 11. Performance Considerations

### Prefetch
- Next/prev page loaded before user click (invisible, leverages pdfjs internal cache)
- ~100-300ms parse time, imperceptible to user

### Canvas Bitmap Copy
- `drawImage()` not `toDataURL()` (free, no encode overhead)
- Reuse single offscreen canvas element (not recreate)

### Text Extraction
- Lazy: only when first search triggered (not on load)
- Cached in WeakMap (500-page book ~50ms one-time cost)

### Selection
- Normalized rects (0–1 %) not absolute pixels (tolerates resize)
- Stored per-highlight, not per-scroll-position (durable)

---

## 12. Future Enhancements

1. **Highlight Sync with Full-Text Search**
   - Show all highlight matches in search results

2. **OCR for Scan PDFs**
   - Tesseract.js for image-only pages
   - Heavy (~5MB gzip), lazy-load on demand

3. **Bookmark & Notes**
   - Save position with custom label (beyond progress)
   - Separate from highlights

4. **Offline Mode**
   - Service Worker + full PDF cache
   - Read without network

5. **Reader Stats**
   - Time spent per page
   - Reading streak

---

## 13. API Endpoints (Supabase)

**Progress Tracking:**
- `POST /progress`: Save page + progress%
- `GET /progress/{bookId}`: Fetch last read page

**Highlights:**
- `POST /highlights`: Create highlight
- `GET /highlights/{bookId}`: List highlights
- `PATCH /highlights/{id}`: Update note
- `DELETE /highlights/{id}`: Remove highlight

**Book Metadata:**
- `GET /books/{id}`: Fetch book info (title, cover, etc.)
- `GET /books/{bookId}/toc`: Fetch outline (if available)

---

## Summary

The BiBo Reader is a full-featured PDF reader with:
- **Caching**: IndexedDB + streaming
- **Selection & Highlighting**: App-level menu to suppress iOS native UI
- **Navigation**: Keyboard, buttons, edge zones, searchable TOC
- **Settings**: Zoom, theme, masks, UI toggles, persisted to localStorage
- **Performance**: Snapshots, prefetch, lazy indexing, debounce saves

Core complexity: managing DOM Selection state + native browser behaviors on iOS + async text extraction. Codebase follows React hooks patterns, TanStack Query for server state, localStorage for client preferences.