import { Music2 } from 'lucide-react';
import { useAudio } from '@/lib/audio/audio-context';
import AudioFloatingWindow from './AudioFloatingWindow';

/**
 * Host audio player ở App root.
 *
 * Quan trọng: AudioFloatingWindow LUÔN mount khi player enabled (ẩn/hiện
 * bằng CSS visibility/opacity, không unmount). Lý do: iframe YouTube nằm
 * trong window đó — unmount = mất tiếng. Modal đóng / chuyển route /
 * "đóng cửa sổ" đều chỉ thay đổi visibility.
 *
 * Khi ẩn (`floatingOpen=false`) mà có queue → hiện mini launcher icon
 * ở góc để user mở lại.
 */
export default function AudioFloatingHost() {
  const { player, floatingOpen, setFloatingOpen } = useAudio();

  if (!player.enabled) return null;

  const hasContent = player.queue.length > 0 || player.currentIndex >= 0;
  // Queue rỗng → unmount window hẳn (destroy iframe). Mount lại khi có
  // bài để giữ invariant "iframe sống suốt khi đang phát".
  if (!hasContent) return null;

  const showLauncher = !floatingOpen;

  return (
    <>
      {/* Window luôn mount để giữ iframe sống — chỉ toggle visibility */}
      <AudioFloatingWindow state={player} hidden={!floatingOpen} />

      {showLauncher && (
        <button
          onClick={() => setFloatingOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/20 px-3 py-2 text-xs text-blue-300 shadow-2xl backdrop-blur hover:bg-blue-500/30"
          title={
            player.currentItem
              ? `Đang phát: ${player.currentItem.title}`
              : 'Mở Audio Player'
          }
        >
          <Music2 className={`h-3.5 w-3.5 ${player.isPlaying ? 'animate-pulse' : ''}`} />
          <span className="max-w-[10rem] truncate">
            {player.currentItem?.title ?? `${player.queue.length} bài`}
          </span>
        </button>
      )}
    </>
  );
}