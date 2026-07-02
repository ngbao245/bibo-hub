---
status: active
last_verified: 2026-07-02
verified_against: src/lib/audio/audio-context.tsx, src/lib/audio/audio-player-hook.ts, src/modals/Audio.tsx, src/components/audio/AudioFloatingHost.tsx, src/components/audio/AudioFloatingWindow.tsx
---

# Audio Player

YouTube-based audio player background: paste link → queue → play mọi lúc, cross-route, cross-tool. Không dừng nhạc khi đóng modal hay chuyển sang tool khác.

## Kiến trúc

```
App root
├─ AudioProvider (mount 1 lần)          → hold state qua React Context
│   └─ useAudioPlayer() hook            → queue + persistedState + signals
│
├─ Routes (mọi route)
│   └─ src/modals/Audio.tsx             → UI modal (playlist manager)
│
└─ AudioFloatingHost (mount 1 lần)
    └─ AudioFloatingWindow              → iframe YT, LUÔN mount khi có queue
                                          (đổi hidden bằng visibility, không unmount)
```

**Iframe invariant**: `AudioFloatingWindow` không được unmount khi đang phát — sẽ mất tiếng. Khi user "đóng" floating window, Kiro chỉ set `hidden=true` (CSS visibility). Chỉ unmount khi queue rỗng (không có gì để giữ).

## Trigger

- **Modal (playlist manager)**: mở qua tool tile ở Hub / shortcut (config động qua Setting)
- **Floating window**: click nút "Floating" trong modal, hoặc launcher `Music2` icon góc phải khi window ẩn nhưng còn queue
- **Auto-play**: chọn item trong queue → `playIndex(idx)` → player enable + play

## State (persist localStorage)

| Key | Content |
|---|---|
| `audio_player_queue` | Array `QueueItem { id, videoId, title, addedAt }` |
| `audio_player_state` | Object: `{ currentIndex, volume, repeatMode, position, size, enabled }` |

**Migration**: field `autoRepeat: boolean` cũ tự convert thành `repeatMode: 'all' | 'off'`.

## Repeat modes

3 modes cycle: `off → all → one → off` (click nút Repeat trong modal).

- `off`: hết queue → dừng, `currentIndex = -1`
- `all`: hết queue → quay về `currentIndex = 0`, phát lại
- `one`: bài hiện tại kết thúc → phát lại chính bài đó (loadVideoById replay signal)

## Signals

Communication giữa `useAudioPlayer` (state) và `AudioFloatingWindow` (iframe control) qua counter signals:

- `playSignal` — bump → window gọi `loadVideoById()` + play
- `pauseSignal` — bump → window gọi `pauseVideo()`
- `isPlaying`, `isLoading` — window callback ngược lên state

Signal counter tránh phụ thuộc reference equality của handler function.

## Position + size

4 corner presets: `bottom-right | bottom-left | top-right | top-left`. Default `bottom-right`, size 280x200. User drag + resize → persist qua `setPosition` / `setSize`.

## Enabled/disabled

- `player.enabled = false` → `AudioFloatingHost` return null, không mount window
- User bấm Power button trong modal → `stop()` + `setEnabled(false)` + đóng floating
- Bật lại qua `playIndex()` hoặc `play()` (auto set enabled = true)

## Queue operations

| Method | Behavior |
|---|---|
| `addToQueue(url)` | Parse videoId → placeholder title → fetch title từ oEmbed API (best-effort) |
| `removeFromQueue(id)` | Nếu xóa item đang play → auto move sang item kế (không dừng nhạc) |
| `moveItem(id, delta)` | Delta ±1, swap với neighbor, update currentIndex nếu bị dịch |
| `clearQueue()` | Reset all, `currentIndex = -1` |
| `next() / prev()` | Wrap around queue (bấm next ở bài cuối → bài đầu) |

## Files

| File | Role |
|---|---|
| `src/lib/audio/audio-context.tsx` | AudioProvider + useAudio hook |
| `src/lib/audio/audio-player-hook.ts` | useAudioPlayer — state + queue + persist logic |
| `src/lib/audio/youtube-api.ts` | Load YT IFrame API (singleton loader) |
| `src/lib/audio/parse-url.ts` | Extract videoId từ URL, fetch title qua oEmbed |
| `src/modals/Audio.tsx` | Modal shell — playlist sidebar + current playing main |
| `src/components/audio/AudioFloatingHost.tsx` | Mount window + launcher icon |
| `src/components/audio/AudioFloatingWindow.tsx` | Draggable window, YT iframe host, controls |
| `src/components/audio/ConfigModal.tsx` | Popover settings (position/repeat/volume) |

## Không có (khác plan cũ)

Doc `audio-tool.md` cũ mention `src/routes/Audio.tsx` + navigation menu item — **KHÔNG ship**. Audio là **modal** chứ không phải route. Xem `audio-tool.md` (deprecated) cho spec ban đầu.

## Edge cases

- **YT API load latency**: `loadYouTubeApi()` singleton, cache promise → paste liên tục không load nhiều lần
- **localStorage quota**: try/catch ở `loadQueue/loadState`, quota exceed → in-memory only
- **URL invalid**: `addToQueue` throw, modal catch → toast error
- **oEmbed CORS fail**: title fetch silent-fail, giữ placeholder `Video {videoId}`
- **Player disable giữa chừng**: floating window unmount → iframe destroy → mất tiếng (intended)
- **Route change**: state giữ qua provider ở App root, iframe không remount

## Debug

Mở DevTools → Application → LocalStorage:
- `audio_player_queue` — kiểm tra queue array
- `audio_player_state` — kiểm tra current index, position, size

Reset toàn bộ: `localStorage.removeItem('audio_player_queue')` + `removeItem('audio_player_state')` → reload.