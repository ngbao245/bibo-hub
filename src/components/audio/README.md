# `components/audio/` — Audio Player UI

YouTube audio player chạy trong floating window persist qua route changes. Phát nhạc nền khi đọc PDF hoặc làm việc khác. Module này lo UI; logic state ở [`src/lib/audio/`](../../lib/audio/README.md).

## Convention

- Chrome (header, controls, seekbar, overlay) dùng `zinc-*` đậm intentional — floating window luôn dark dù app có light mode sau này. Đây là exception trong rule theme tokens (xem `.kiro/steering/system.md`).
- Iframe YouTube luôn mount khi `enabled=true` (off-screen khi `hidden`) để giữ tiếng qua mọi visibility toggle. KHÔNG unmount theo visibility.
- Click trong vùng iframe đi qua `<div role="button">` (không phải `<button>` thật) để không steal focus khỏi container — keyboard shortcut cần focus container outer.

## File

| File | Vai trò |
|---|---|
| `AudioFloatingHost.tsx` | Mount điểm tại app root: render floating window + launcher mini icon khi window hidden. Đọc `useAudio` context để biết `floatingOpen`. |
| `AudioFloatingWindow.tsx` | Floating window chính: drag/resize, header, iframe YT, seekbar, controls, keyboard shortcuts, flash toast. |
| `QueueManagerModal.tsx` | Modal quản lý queue: add link, remove, reorder, clear. |
| `ConfigModal.tsx` | Modal config volume + repeat mode. |

## Keyboard Shortcuts (chỉ active khi window có focus)

| Phím | Action |
|---|---|
| `Space` | Toggle play/pause |
| `←` / `→` | Seek (cộng dồn: +10s mỗi nhấn khi `\|accum\|` < 60s, +30s khi vượt). Debounce 400ms commit. Đổi chiều → reset accum. |
| `↑` / `↓` | Volume ±5 |

Flash toast hiện giữa video ~900ms hiển thị primary (`+30s`, `75%`) + secondary (vị trí mới `m:ss / m:ss`). Font + padding scale theo `size.width` để cân với window.

## Floating window lifecycle

- `enabled=false` → component return null, destroy YT player.
- `enabled=true` + `hidden=false` → render bình thường, focus container auto khi mount/unhide.
- `enabled=true` + `hidden=true` → render off-screen (`left/top: -9999, opacity: 0, pointer-events: none`). Blur container, ignore keydown. iframe vẫn alive.

Lý do dùng off-screen thay vì `visibility: hidden`: browser deprioritize / suspend iframe khi `visibility: hidden` → âm thanh có thể bị throttle ở vài browser.

## Replay sau ENDED

Có 2 code path xử lý ENDED:

1. **Same-song repeat** (repeat='one' hoặc repeat='all' với queue ≤1): xử lý trực tiếp trong `onStateChange ENDED` qua `seekTo(0) + playVideo()` trên YT player ref. KHÔNG đi qua React state (đường `handleEnded → playSignal → effect → playVideo` từng bị skip ở lần replay thứ 2 do effect deps không đổi).
2. **Advance/wrap/off**: gọi `state.handleEnded()` để update `currentIndex` rồi đi effect chuẩn.

`togglePlayPause` cũng có path riêng cho YT state = ENDED → tự `seekTo(0) + playVideo()` trước khi sync React state, tránh user bấm play sau khi queue hết mà không có phản ứng.

## Seekbar

- Drag pointer → preview ngay, commit khi thả. Giữ preview thêm 600ms sau commit để YT seek xong (poll `getCurrentTime` còn trả vị trí cũ trong vài frame đầu).
- Hover bất kỳ vị trí → tooltip thời gian nổi lên đáy vùng video.
- Poll `currentTime/duration` 500ms khi đang playing. Block overwrite preview khi `seekDragging` hoặc `keySeeking`.

## Doc liên quan

- **[docs/audio-player.md](../../../docs/audio-player.md)** — spec player tổng quan.
- **[docs/audio-tool.md](../../../docs/audio-tool.md)** — tool config / modal flow.
- **[src/lib/audio/README.md](../../lib/audio/README.md)** — hook + YT API loader + parse URL.