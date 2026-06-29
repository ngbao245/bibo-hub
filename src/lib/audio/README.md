# `lib/audio/` — Audio Player Logic

Hook quản state queue + playback + config cho YouTube floating player. UI ở [`src/components/audio/`](../../components/audio/README.md).

## File

| File | Vai trò |
|---|---|
| `audio-player-hook.ts` | `useAudioPlayer()` — state queue, currentIndex, volume, repeat, position/size, isPlaying, isLoading. Persist localStorage. Trigger play/pause qua `playSignal`/`pauseSignal` (counter tăng dần). |
| `audio-context.tsx` | React context expose `floatingOpen` + `setFloatingOpen`. Cho phép launcher icon mở lại window từ ngoài. |
| `youtube-api.ts` | Loader singleton cho `https://www.youtube.com/iframe_api` + types `YTPlayer`, `YTPlayerOptions`, const `YT_STATE`. |
| `parse-url.ts` | `parseYouTubeId(input)` từ URL/ID dạng watch/shorts/youtu.be. `fetchYouTubeTitle(videoId)` best-effort qua oEmbed (CORS sometimes fail → fallback placeholder). |

## State convention

Hook trả về 1 object lớn. Tránh truyền cả object xuống component con — destruct field cần thiết để minimize re-render. Trong `AudioFloatingWindow` đã dùng pattern refs (`setIsPlayingRef`, `handleEndedRef`...) để event handlers YT không bị stale closure.

### Signal pattern

`playSignal` và `pauseSignal` là counter — mỗi lần user trigger play/pause, counter +1. Component listener so sánh với `lastSignalRef` để biết có signal mới hay không. Cho phép trigger play cùng bài (cùng `currentIndex`) mà không cần state-shape change.

⚠️ Đường vòng signal đã từng bị React skip effect khi deps không đổi sau replay đầu — case repeat-one. Fix bằng cách handle ENDED replay TRỰC TIẾP trong `onStateChange` YT, không qua signal. Xem [`components/audio/README.md`](../../components/audio/README.md#replay-sau-ended).

## Persist

| Key | Nội dung |
|---|---|
| `audio_player_queue` | Array `QueueItem[]` |
| `audio_player_state` | `{ currentIndex, volume, repeatMode, minimized, position, size, enabled }` |

Có migration v1 → v2: `autoRepeat: boolean` → `repeatMode: 'off' \| 'all' \| 'one'`.

State debounce 300ms để batch các change liên tục (vd resize drag).

## Repeat mode

- `off` — hết queue → dừng, `currentIndex = -1`.
- `all` — hết queue → wrap về index 0, fire `playSignal`.
- `one` — hết bài → replay bài hiện tại, fire `playSignal`.

Cycle: `cycleRepeatMode()` → `off → all → one → off`.

## YouTube IFrame API

Player vars set ở `AudioFloatingWindow`:
- `controls: 0` — ẩn UI YT, dùng controls custom.
- `modestbranding: 1`, `rel: 0`, `iv_load_policy: 3`, `fs: 0`, `disablekb: 1`.
- `autoplay: 0` — chờ user trigger.

KHÔNG truyền `videoId` khi chưa có (queue trống) — YT widget gọi `cueVideoById(undefined)` → throw "Invalid video id".

## Doc liên quan

- **[docs/audio-player.md](../../../docs/audio-player.md)** — spec player tổng quan.
- **[docs/audio-tool.md](../../../docs/audio-tool.md)** — tool config / modal flow.
- [YT IFrame API reference](https://developers.google.com/youtube/iframe_api_reference)