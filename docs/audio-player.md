---
status: deprecated
last_verified: 2026-07-02
replacement: docs/audio.md
reason: spec v2 cho Opus, feature đã ship (queue, floating, config), nội dung trùng audio-tool.md
---

# Audio Player Tool — Spec cho Opus Implementation

> **[Deprecated]** File này là spec ban đầu, giữ làm lịch sử. State hiện tại xem `docs/audio.md`. Hầu hết feature list ở đây (queue, floating window, config modal, auto-repeat) đã ship xong.

## Mục Tiêu

Chuyển YouTube mini player hiện tại thành **standalone audio tool** với full-featured playlist management, background playback, draggable floating window, corner positioning, resizable UI.

**Current State (v1):**
- Single YouTube video player
- URL paste input (popover ở header)
- Floating panel cố định góc dưới phải
- Auto-loop current video

**Target State (v2 - Opus Implementation):**
- Queue nhạc (thêm/remove/reorder songs)
- Auto-replay khi hết queue
- Floating window: draggable, resizable, 4 corner presets
- Background playback (persist state khi close/open tab)
- Config button → tắt tool (modal settings)

---

## Architecture

### Data Layer

**Queue Item:**
```ts
{
  id: string;                    // unique ID (uuid)
  videoId: string;               // 11-char YouTube ID
  title: string;                 // từ user paste URL hoặc manual input
  addedAt: number;               // timestamp
  duration?: number;             // optional, parsed từ YT metadata
}
```

**Player State (localStorage):**
```ts
{
  queue: QueueItem[];
  currentIndex: number;          // -1 = stopped
  isPlaying: boolean;
  volume: number;                // 0–1
  autoRepeat: boolean;           // default: true
  minimized: boolean;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';  // default: 'bottom-right'
  size: { width: number; height: number };  // default: {w: 360, h: 200}
}
```

**Keys:**
- `audio_player_queue`: JSON array
- `audio_player_state`: JSON state object
- `audio_player_config`: JSON config

### Hook: `useAudioPlayer` (enhanced)

**Responsibilities:**
- Load/persist queue từ localStorage
- Manage playback state (play/pause/stop/next/prev)
- Track current video
- Handle auto-advance (khi iframe onend or manually)
- Position + size management

**API:**
```ts
const player = useAudioPlayer();

{
  // Queue
  queue: QueueItem[];
  addToQueue: (videoId: string, title?: string) => void;
  removeFromQueue: (id: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;

  // Playback
  currentIndex: number;
  currentVideo: QueueItem | null;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;

  // UI State
  minimized: boolean;
  setMinimized: (v: boolean) => void;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  setPosition: (pos: Position) => void;
  size: { width: number; height: number };
  setSize: (w: number, h: number) => void;

  // Config
  autoRepeat: boolean;
  setAutoRepeat: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;

  // Utils
  parseYouTubeUrl: (url: string) => string | null;
}
```

### Components

#### 1. **AudioPlayerButton** (Header Button)
- Click → mở **Queue Manager Modal**
- Badge: queue length / current playing indicator
- Accessible từ cả mobile + desktop header (2 instances via hook state)

#### 2. **QueueManagerModal** (Popover/Modal)
**UI:**
- Input field: paste YouTube URL
  - Auto-parse videoId, fetch title từ YT API (nếu possible) hoặc user enter
- Queue list:
  - Drag-to-reorder (dnd library hoặc custom)
  - Play button on each item
  - Remove button on each item
- Control buttons:
  - Play All (start từ index 0)
  - Clear Queue
  - Shuffle
- Auto-repeat toggle
- "Config" button → tắt player

#### 3. **AudioFloatingWindow** (Floating Panel)
**Features:**
- Draggable header bar
- Resize handle (bottom-right corner)
- Position presets: 4 buttons để pick corner (top-left, top-right, bottom-left, bottom-right)
- Minimize button → show mini icon + restore button
- Close button
- Display:
  - Current video thumbnail / title
  - Progress bar (từ iframe khó lấy, có thể skip or play/pause only)
  - Play/Pause button
  - Next/Prev buttons
  - YouTube iframe (h-40 w-72 default, resizable)

#### 4. **FloatingWindowHeader**
- Title + video name
- Drag handle (pointer: grab)
- Buttons: position-picker, minimize, close
- Persisted position + size

#### 5. **ConfigModal**
- Settings để disable/enable player
- Default position/size reset
- Clear queue button
- About / help text

---

## Implementation Plan

### Phase 1: Core Queue + State Management
1. Enhance `useAudioPlayer` hook:
   - Add queue array
   - Add CRUD operations (add/remove/reorder)
   - Persist queue to localStorage
   - Auto-advance logic

2. Create `QueueManagerModal` component:
   - Simple list view (no drag yet)
   - Add URL input
   - Remove buttons
   - Play button per item

3. Update `AudioButton`:
   - Pass hook state
   - Render updated button with queue info

### Phase 2: Floating Window with Dragging
1. Enhance `AudioFloatingPanel`:
   - Position state (4 corners)
   - Draggable header (use react-rnd or custom mousedown/move)
   - Resize handle (custom or library)
   - Position preset buttons

2. Persist position + size to localStorage

### Phase 3: Advanced Features
1. Add drag-to-reorder in queue (react-beautiful-dnd or simpler solution)
2. Mini thumbnail display (parse YT embed)
3. Config modal for enable/disable
4. Volume control (YouTube iframe volume param)

---

## Integration Points

**Files to Create:**
- `src/lib/audio/audio-player-hook.ts`: Enhanced useAudioPlayer hook
- `src/components/audio/QueueManagerModal.tsx`: Queue CRUD UI
- `src/components/audio/AudioFloatingWindow.tsx`: Draggable + resizable panel
- `src/components/audio/ConfigModal.tsx`: Settings

**Files to Modify:**
- `src/components/reader/PdfReader.tsx`: Import new components, wire into layout
- `src/components/reader/AudioPlayer.tsx`: Refactor into smaller pieces OR move exports to new files

**Optional Libraries:**
- Drag-and-drop: `react-beautiful-dnd` or `dnd-kit` (if not already in stack)
- Draggable window: `react-rnd` or custom
- Toast notifications: `sonner` (already in project)

---

## UI Layout

**Header:** `[← Back] [Title] ... [TTS Button] [Audio Button 🎵] [Settings] `

**When Audio Playing:**
```
┌─────────────────────────────────────┐
│ 📊 Current: "Song Title"     [─] [X]│  <- Header (draggable)
├─────────────────────────────────────┤
│                                     │
│  [YouTube iframe 360×150]           │  <- Resizable
│  ▶ ⏸ ⏭ ⏮ [Progress bar]            │
│                                     │
│  [TL] [TR]  [Queue: 5]              │  <- Corner pickers + queue info
│  [BL] [BR]                          │
└─────────────────────────────────────┘  <- Resize handle (bottom-right)
```

**Minimized:**
```
┌──────────────┐
│ 🎵 Song...   │  <- Click to restore
└──────────────┘
```

---

## Behavior Spec

### Auto-Replay Flow
1. User play queue (index 0)
2. When current video ends (iframe onend or manual next at last index):
   - If `autoRepeat = true` → reset to index 0, auto-play
   - Else → stop (stay at last item, paused)

### Dragging & Position
- Click + drag header → move window
- Release → save position to localStorage
- Corner buttons preset position in viewport
- Resize handle (bottom-right corner) → drag to resize, cap min 280×150

### URL Parsing
- Accept YouTube URL (watch, youtu.be, shorts, embed)
- Also accept raw 11-char videoId
- On add → optional fetch title from YT (if CORS allows) or use placeholder

### Queue Persistence
- Save queue + state every action (add/remove/play/next)
- Restore on mount
- Allow clear via button or via config

---

## Considerations

### Performance
- Iframe embed: each video loads separately. Multiple iframes = multiple players = bandwidth.
  - **Solution:** Only 1 iframe visible at a time (swap src on next/prev)
- Queue list long: virtualize if > 100 items
- Dragging: debounce save to localStorage (~500ms)

### Browser Support
- localStorage: all modern browsers
- Drag API: custom mousedown/move or use library (react-rnd has IE11 fallback)
- YouTube iframe: universally supported

### Edge Cases
- User drag window off screen → clamp to visible area
- Resize to very small → enforce min size
- Queue empty → show empty state, disable play buttons
- Invalid YouTube ID → show error, skip to next
- localStorage quota exceeded → graceful fallback (queue in memory only)

---

## Testing (Optional)

- Queue add/remove/reorder
- Playback next/prev at boundaries
- Auto-repeat toggle
- Position + size persistence
- Modal open/close
- Dragging (manual testing recommended)

---

## Future Enhancements (Post-MVP)

1. **Playlist Save/Load** from Supabase
2. **Search YouTube API** to add songs
3. **Lyrics Display** (fetch from YouTube captions or third-party)
4. **Now Playing Display** in main reader header
5. **Remote Control** (phone → desktop player)
6. **Sound Visualization** (canvas spectrum analyzer)
7. **Hotkeys** (Space = play/pause, Arrow = next/prev)
8. **Theme Integration** (follow reader theme: light/sepia/dark)

---

## Implementation Checklist (for Opus)

- [ ] Create `audio-player-hook.ts` with queue + state management
- [ ] Create `QueueManagerModal.tsx` for add/remove/reorder
- [ ] Create `AudioFloatingWindow.tsx` with dragging + resizing
- [ ] Create `ConfigModal.tsx` for settings
- [ ] Update `PdfReader.tsx` to wire new components
- [ ] Test localStorage persistence
- [ ] Test queue playback flow
- [ ] Test window dragging + resizing
- [ ] Test auto-replay
- [ ] Refactor `AudioPlayer.tsx` exports or consolidate files
- [ ] Update `docs/reader.md` with audio tool section
- [ ] Test responsive (mobile may need adapted UI for dragging)

---

## Code References (Current v1)

**Files:**
- `src/components/reader/AudioPlayer.tsx`: Existing single-video player
  - `useAudioPlayer()` hook: manages url, videoId, panelOpen, minimized
  - `AudioButton` component: header button + URL input popover
  - `AudioFloatingPanel` component: fixed position iframe

**Integration in PdfReader:**
- Line 23: import
- Line 505: `const audio = useAudioPlayer()`
- Line 605, 751: `<AudioButton state={audio} />`
- Line 921: `<AudioFloatingPanel state={audio} />`

---

## Summary

This tool transforms a single YouTube video player into a **full-featured audio player** with queue management, draggable window, and persistent background playback. Key additions: queue CRUD, auto-replay, floating window with drag/resize, 4 corner positioning, config modal. Opus should create new components for queue/config modals, enhance hook for queue state, and integrate dragging library. Maintain existing reader integration point (hook in PdfReader, components render at 2 positions).