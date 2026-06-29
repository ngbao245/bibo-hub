import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Loader2,
  Play,
  Power,
  Repeat,
  Repeat1,
  Settings2,
  SkipBack,
  SkipForward,
  Trash2,
  Pause,
} from 'lucide-react';
import { toast } from 'sonner';
import ToolModal from '@/components/ToolModal';
import { useAudio } from '@/lib/audio/audio-context';
import ConfigModal from '@/components/audio/ConfigModal';
import { parseYouTubeId } from '@/lib/audio/parse-url';

/**
 * Audio modal — playlist manager. Player thực tế là floating window
 * mount ở App root (qua AudioProvider) — modal này chỉ là UI quản lý
 * queue + controls lớn. Đóng modal KHÔNG dừng nhạc, vì floating window
 * vẫn render khi `currentIndex >= 0`.
 */
export default function Audio() {
  return (
    <ToolModal id="audio" title="Audio Player" className="max-w-3xl">
      <AudioModalContent />
    </ToolModal>
  );
}

function AudioModalContent() {
  const { player, setFloatingOpen } = useAudio();
  const [input, setInput] = useState('');
  const [configOpen, setConfigOpen] = useState(false);

  /**
   * Auto-add khi paste / type được URL hoặc videoId hợp lệ.
   * Không có nút thêm — input thành "drop zone" cho YouTube link.
   */
  const handleInputChange = (value: string) => {
    setInput(value);
    const trimmed = value.trim();
    if (!trimmed) return;
    const videoId = parseYouTubeId(trimmed);
    if (!videoId) return;
    setInput('');
    void player.addToQueue(trimmed).catch((err) => {
      toast.error(err instanceof Error ? err.message : 'Không thêm được');
    });
  };

  return (
    <div className="flex h-[28rem] gap-3">
      {/* Sidebar: queue list */}
      <aside className="flex w-72 shrink-0 flex-col rounded border border-border bg-card">
        <div className="space-y-2 border-b border-border p-2.5">
          <input
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Paste YouTube URL để thêm..."
            className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:border-ring focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <button
              type="button"
              onClick={player.cycleRepeatMode}
              className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${
                player.repeatMode === 'off'
                  ? 'text-muted-foreground hover:bg-popover hover:text-foreground'
                  : 'bg-primary/15 text-primary hover:bg-primary/25'
              }`}
              title={
                player.repeatMode === 'off'
                  ? 'Tắt lặp'
                  : player.repeatMode === 'all'
                    ? 'Lặp playlist'
                    : 'Lặp bài hiện tại'
              }
            >
              {player.repeatMode === 'one' ? (
                <Repeat1 className="h-3.5 w-3.5" />
              ) : (
                <Repeat className="h-3.5 w-3.5" />
              )}
              <span>
                {player.repeatMode === 'off'
                  ? 'No repeat'
                  : player.repeatMode === 'all'
                    ? 'Repeat all'
                    : 'Repeat one'}
              </span>
            </button>
            <button
              onClick={() => {
                if (window.confirm('Xóa tất cả bài?')) player.clearQueue();
              }}
              disabled={player.queue.length === 0}
              className="rounded px-2 py-0.5 text-muted-foreground hover:bg-popover hover:text-destructive disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {player.queue.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Playlist trống. Paste link YouTube ở trên để bắt đầu.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {player.queue.map((item, idx) => {
                const isCurrent = idx === player.currentIndex;
                return (
                  <li
                    key={item.id}
                    className={`group flex items-center gap-1 px-2.5 py-2 ${
                      isCurrent ? 'bg-primary/10' : 'hover:bg-popover'
                    }`}
                  >
                    <button
                      onClick={() => player.playIndex(idx)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-popover hover:text-foreground"
                      title="Phát"
                    >
                      <Play className="h-3 w-3" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-xs ${
                          isCurrent ? 'text-primary' : 'text-foreground'
                        }`}
                        title={item.title}
                      >
                        {item.title}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {item.videoId}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => player.moveItem(item.id, -1)}
                        disabled={idx === 0}
                        className="rounded p-1 text-muted-foreground hover:bg-popover hover:text-foreground disabled:opacity-30"
                        title="Lên"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => player.moveItem(item.id, 1)}
                        disabled={idx === player.queue.length - 1}
                        className="rounded p-1 text-muted-foreground hover:bg-popover hover:text-foreground disabled:opacity-30"
                        title="Xuống"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => player.removeFromQueue(item.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-popover hover:text-destructive"
                        title="Xóa"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Main: current playing info + giant controls */}
      <main className="relative flex flex-1 flex-col items-center justify-center rounded border border-border bg-card p-6">
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <button
            onClick={() => setFloatingOpen(true)}
            className="flex items-center gap-1 rounded bg-popover px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            title="Mở floating window"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Floating</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setConfigOpen(true)}
              className="rounded p-1.5 text-muted-foreground hover:text-foreground"
              title="Cấu hình"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
            <ConfigModal
              state={player}
              open={configOpen}
              onClose={() => setConfigOpen(false)}
            />
          </div>
          <button
            onClick={() => {
              player.stop();
              player.setEnabled(false);
              setFloatingOpen(false);
            }}
            className="rounded p-1.5 text-muted-foreground hover:text-destructive"
            title="Tắt player (dừng nhạc, đóng floating)"
          >
            <Power className="h-3.5 w-3.5" />
          </button>
        </div>

        {player.currentItem ? (
          <div className="flex w-full max-w-sm flex-col items-center gap-3">
            <img
              src={`https://i.ytimg.com/vi/${player.currentItem.videoId}/hqdefault.jpg`}
              alt={player.currentItem.title}
              className="aspect-video w-full rounded border border-border object-cover shadow-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="text-center">
              <div className="text-sm font-medium text-foreground" title={player.currentItem.title}>
                {player.currentItem.title}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {player.currentIndex + 1} / {player.queue.length}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={player.prev}
                className="rounded-full p-2 text-muted-foreground hover:bg-popover hover:text-foreground"
                title="Bài trước"
              >
                <SkipBack className="h-5 w-5" />
              </button>
              <button
                onClick={player.isPlaying ? player.pause : player.play}
                disabled={player.isLoading}
                className="rounded-full bg-primary/15 p-3 text-primary hover:bg-primary/25 disabled:opacity-70"
                title={
                  player.isLoading ? 'Đang tải...' : player.isPlaying ? 'Tạm dừng' : 'Phát'
                }
              >
                {player.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : player.isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6" />
                )}
              </button>
              <button
                onClick={player.next}
                className="rounded-full p-2 text-muted-foreground hover:bg-popover hover:text-foreground"
                title="Bài sau"
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Đóng modal vẫn tiếp tục phát qua floating window.
            </p>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            <Play className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p>Chọn bài từ playlist để bắt đầu phát</p>
            <p className="mt-1 text-xs">Hoặc paste YouTube URL ở sidebar</p>
          </div>
        )}
      </main>
    </div>
  );
}