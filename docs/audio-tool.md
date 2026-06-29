# Audio Player Tool — Spec cho Opus Implementation

## Mục Tiêu

Tạo **Audio Player** thành **standalone tool** mới ở main navigation (bên cạnh Reader, Notes, Tasks, ...), không phụ thuộc vào Reader. Cho phép user nghe nhạc từ YouTube playlist, có thể dùng ở bất kỳ route nào. Ở Reader, chỉ thêm nút trigger để inject tool vào floating window (shortcut tiện lợi, không bắt buộc).

**Architecture:**
- **Standalone tool:** Route `/audio` ở main layout, full-page player
- **Floating widget:** Có thể mở từ Reader (nút 🎵), hoặc độc lập
- **Global state:** Hook `useAudioPlayer` lưu localStorage, mount 1 lần ở root (`<App/>` hoặc layout cao nhất)
- **Cross-context:** User mở Reader → click nút audio → player widget hiện (có thể move qua Notes, Tasks, ...)

---

## Current Implementation (v1)

**Files hiện tại:**
- `src/lib/audio/youtube-api.ts` — YT IFrame API loader
- `src/lib/audio/parse-url.ts` — Parse URL + fetch title
- `src/lib/audio/audio-player-hook.ts` — Hook queue + state persist
- `src/components/audio/AudioPlayerButton.tsx` — Header button + modals
- `src/components/audio/AudioFloatingWindow.tsx` — Draggable window
- `src/components/audio/QueueManagerModal.tsx` — Queue CRUD
- `src/components/audio/ConfigModal.tsx` — Settings

**Current Usage:** Embedded ở PdfReader (line 507, 607, 753, 923)

---

## Target State (v2 - Opus Implementation)

### 1. Refactor Hook → Global Context

**New file:** `src/lib/audio/audio-context.tsx`

```tsx
import { createContext, useContext, ReactNode } from 'react';
import { useAudioPlayer, type AudioPlayer } from './audio-player-hook';

interface AudioContextType {
  player: AudioPlayer;
  isFloatingOpen: boolean;
  setFloatingOpen: (v: boolean) => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(); // Mount once globally
  const [isFloatingOpen, setFloatingOpen] = useState(false);

  return (
    <AudioContext.Provider value={{ player, isFloatingOpen, setFloatingOpen }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be within AudioProvider');
  return ctx;
}
```

**Integration in App.tsx:**
```tsx
<AudioProvider>
  <Router>
    {/* routes */}
  </Router>
  <AudioFloatingWindow /> {/* Global, always available */}
</AudioProvider>
```

### 2. Create Standalone Tool Route

**New file:** `src/routes/Audio.tsx`

```tsx
import { useState } from 'react';
import { useAudio } from '@/lib/audio/audio-context';
import QueueManagerModal from '@/components/audio/QueueManagerModal';
import ConfigModal from '@/components/audio/ConfigModal';

export default function AudioRoute() {
  const { player } = useAudio();
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div className="flex h-full gap-4 bg-zinc-950 p-4">
      {/* Sidebar: Queue list (like Reader sidebar TOC) */}
      <aside className="w-80 overflow-y-auto rounded border border-zinc-800 bg-zinc-900 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-200">Playlist</h2>
          <button onClick={() => setConfigOpen(true)} className="text-xs text-zinc-400 hover:text-zinc-100">
            ⚙
          </button>
        </div>
        {player.queue.length === 0 ? (
          <p className="text-xs text-zinc-500">Chưa có bài nào</p>
        ) : (
          <ul className="space-y-1">
            {player.queue.map((item, idx) => (
              <li
                key={item.id}
                onClick={() => player.playIndex(idx)}
                className={`cursor-pointer truncate rounded px-2 py-1 text-xs ${
                  idx === player.currentIndex
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
                title={item.title}
              >
                {item.title}
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Main: Player UI + Add input */}
      <main className="flex-1">
        <QueueManagerModal
          state={player}
          open={true}
          onClose={() => {}}
          onOpenConfig={() => setConfigOpen(true)}
        />
      </main>

      <ConfigModal state={player} open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  );
}
```

**Add route:** `src/App.tsx` hoặc router config
```tsx
import Audio from '@/routes/Audio';

// Thêm vào routes array:
{ path: '/audio', element: <Audio /> }
```

### 3. Update Reader Integration

**Simplify:** Remove standalone player từ PdfReader, chỉ giữ button trigger.

**New file:** `src/components/reader/AudioTriggerButton.tsx`

```tsx
import { Music, Music2 } from 'lucide-react';
import { useAudio } from '@/lib/audio/audio-context';
import { useNavigate } from 'react-router-dom';

export default function AudioTriggerButton() {
  const { player, setFloatingOpen } = useAudio();
  const navigate = useNavigate();

  return (
    <button
      onClick={() => {
        // Option 1: Open floating window
        setFloatingOpen(true);
        // Option 2: Navigate to tool
        // navigate('/audio');
      }}
      className={`p-1.5 ${
        player.currentIndex >= 0 ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-100'
      }`}
      title="Mở playlist"
    >
      {player.currentIndex >= 0 ? <Music2 className="h-4 w-4" /> : <Music className="h-4 w-4" />}
    </button>
  );
}
```

**In PdfReader:**
```tsx
// Replace AudioPlayerButton với:
import AudioTriggerButton from './AudioTriggerButton';

// Line 607 (mobile) + 753 (desktop):
<AudioTriggerButton />
```

### 4. Global Floating Window

**Update:** `src/components/audio/AudioFloatingWindow.tsx`

- Already implemented, render từ App root via context
- Always available từ bất kỳ route
- Persist position + size (localStorage)

---

## Navigation Integration

**Main nav (App layout):**
```
[Home] [Reader] [Notes] [Tasks] ... [Audio] [Settings]
```

**Or dropdown menu:**
```
[Tools ▼]
  - Reader
  - Notes
  - Tasks
  - Audio
  - Settings
```

**Implementation:** Update router + layout component tương tự Reader, Notes, Tasks.

---

## File Structure (Final)

```
src/
├── lib/audio/
│   ├── youtube-api.ts (no change)
│   ├── parse-url.ts (no change)
│   ├── audio-player-hook.ts (no change)
│   └── audio-context.tsx (NEW)
├── components/audio/
│   ├── AudioPlayerButton.tsx (no change, or remove if only using via context)
│   ├── AudioFloatingWindow.tsx (no change)
│   ├── QueueManagerModal.tsx (no change)
│   ├── ConfigModal.tsx (no change)
│   └── (optional) AudioPlayerBar.tsx (mini control bar if needed)
├── components/reader/
│   ├── AudioTriggerButton.tsx (NEW - simple button)
│   └── PdfReader.tsx (MODIFIED - replace AudioPlayerButton with AudioTriggerButton)
├── routes/
│   ├── Audio.tsx (NEW - standalone tool route)
│   ├── Reader.tsx (no change)
│   ├── Notes.tsx (existing)
│   ├── Tasks.tsx (existing)
│   └── ... (existing)
├── App.tsx (MODIFIED - wrap with AudioProvider, add /audio route)
└── docs/
    └── audio-tool.md (this file)
```

---

## Data Flow

**1. User opens Reader:**
```
PdfReader (mounts AudioTriggerButton)
  → click button
    → useAudio() → setFloatingOpen(true)
      → AudioFloatingWindow renders (global, via App context)
        → Draggable window shows up
        → User paste URL → hook.addToQueue()
          → queue state update
            → persist localStorage
              → render queue in floating window
```

**2. User navigates to /audio:**
```
AudioRoute (full-page tool)
  → useAudio() (same hook as floating window uses)
  → render sidebar + main player UI
  → same queue state (shared via context)
    → If floating window was open, both sync
```

**3. User can minimize floating window:**
```
AudioFloatingWindow
  → minimize button
    → setMinimized(true)
      → show small icon (corner)
      → user can navigate /audio, Notes, Tasks
      → music continues playing (iframe persists)
      → click icon → restore window
```

---

## User Stories

1. **Open Reader + play music:**
   - Click 🎵 button ở Reader header
   - Floating window appears (góc dưới phải)
   - Paste YouTube URL
   - Music plays while reading

2. **Full-screen music experience:**
   - Click "Audio" ở main nav
   - Go to /audio (full-page player)
   - Large queue list (sidebar)
   - Main player with controls
   - Can minimize to floating window + switch tool

3. **Cross-tool listening:**
   - Start music ở Reader floating window
   - Navigate to Notes/Tasks
   - Music keeps playing
   - Floating window follows (draggable)
   - Or switch to /audio full-page

4. **Configure + disable:**
   - Click Settings ⚙ ở floating window
   - Adjust volume, corner position, size
   - Toggle auto-repeat
   - Disable player (button becomes muted icon)
   - Re-enable from muted button

---

## Implementation Checklist (for Opus)

### Phase 1: Context + Provider
- [ ] Create `audio-context.tsx` with AudioProvider + useAudio hook
- [ ] Update `App.tsx` to wrap routes with AudioProvider
- [ ] Add global `<AudioFloatingWindow />` render (inside AudioProvider)
- [ ] Verify context works (test useAudio() from child components)

### Phase 2: Standalone Route
- [ ] Create `routes/Audio.tsx` page layout
- [ ] Add `/audio` route to router config
- [ ] Add "Audio" to main navigation (nav menu / sidebar)
- [ ] Test route navigation

### Phase 3: Reader Integration
- [ ] Create `components/reader/AudioTriggerButton.tsx`
- [ ] Replace `AudioPlayerButton` with `AudioTriggerButton` in PdfReader
- [ ] Test button opens floating window
- [ ] Remove old AudioButton logic if needed

### Phase 4: Testing & Polish
- [ ] Test queue persists across route changes
- [ ] Test floating window drag + resize works from all routes
- [ ] Test music continues playing when switching tools
- [ ] Test minimize/restore on floating window
- [ ] Test config modal (volume, position, auto-repeat)
- [ ] Test disable/enable player

### Phase 5: Documentation
- [ ] Update `docs/reader.md` — remove audio section (now separate tool)
- [ ] Update main navigation docs
- [ ] Add "Audio" to tools list in any app overview docs

---

## Key Design Decisions

1. **Single hook instance:** `useAudioPlayer()` mounts once via provider at App root
   - Ensures state sync across all components
   - Simplifies localStorage management
   - Single YT IFrame Player instance

2. **Floating window always global:** Render from App context, not route-specific
   - Available from any tool (Reader, Notes, Tasks, etc.)
   - Persist position + song across navigation
   - User can minimize ↔ maximize anytime

3. **Reader button = trigger only:** No duplicate UI logic
   - Reduces complexity
   - Reader remains focused on PDF reading
   - Follows principle of single responsibility

4. **URL-based routing:** `/audio` is first-class route
   - Bookmarkable: user can link `/audio`
   - Full-page experience when needed
   - Fits app's tool-based navigation pattern

---

## Edge Cases & Considerations

- **localStorage quota:** If exceeded, queue stays in-memory (no persist) — document fallback behavior
- **YouTube API latency:** First load ~200-500ms (load iframe_api.js), then instant — show loader?
- **Multiple browsers/tabs:** localStorage sync limited (no real-time sync across tabs) — acceptable for MVP
- **Mobile responsive:** Floating window size/position on mobile — pre-set smaller defaults?
- **No internet:** YouTube embed won't load — show offline message
- **Very long queue:** Consider virtualization if > 100 items (sidebar)

---

## Future Enhancements (Post-MVP)

1. **Playlist save/load** from Supabase
2. **Search YouTube API** to add songs (instead of only URL paste)
3. **Lyrics display** (fetch from captions)
4. **Hotkeys:** Space = play/pause, Arrow keys = next/prev, M = mute
5. **Theme sync:** Audio tool follows reader theme (light/sepia/dark)
6. **Sound visualization:** Spectrum analyzer
7. **Now playing** in main nav badge
8. **Export playlist** (JSON/M3U)

---

## Summary

Audio Player transforms from **Reader feature** → **Standalone tool** while maintaining flexibility. Users can:
- Use floating window from any tool (Reader, Notes, Tasks)
- Access full-page player at `/audio` for dedicated music experience
- Minimize to corner icon + navigate freely
- Keep music playing across the app

Implementation strategy: Extract to context (global state), create new route, simplify Reader integration (button → trigger only). Reuse existing components (modals, floating window). Mount hook once at App root for single state instance.

Core complexity: Coordinate global state + floating window + multiple routes + localStorage persistence. Solution: Context API + hook-based state management ✓ Already partially done, just needs restructuring to global scope.