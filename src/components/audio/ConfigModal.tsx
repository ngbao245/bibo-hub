import {
  Repeat,
  Repeat1,
  SquareArrowOutDownLeft,
  SquareArrowOutDownRight,
  SquareArrowOutUpLeft,
  SquareArrowOutUpRight,
  X,
} from 'lucide-react';
import type { AudioPlayer, CornerPosition, RepeatMode } from '@/lib/audio/audio-player-hook';

interface Props {
  state: AudioPlayer;
  open: boolean;
  onClose: () => void;
}

const POS_META: Record<CornerPosition, { label: string; icon: typeof SquareArrowOutUpLeft }> = {
  'top-left': { label: 'Góc trên trái', icon: SquareArrowOutUpLeft },
  'top-right': { label: 'Góc trên phải', icon: SquareArrowOutUpRight },
  'bottom-left': { label: 'Góc dưới trái', icon: SquareArrowOutDownLeft },
  'bottom-right': { label: 'Góc dưới phải', icon: SquareArrowOutDownRight },
};

const POS_ORDER: CornerPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export default function ConfigModal({ state, open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      data-audio-popup
      className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-sm font-medium text-zinc-200">Cấu hình player</span>
        <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3 p-3">
        {/* Enable / Disable */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-300">Bật player</span>
          <button
            onClick={() => state.setEnabled(!state.enabled)}
            className={`rounded px-2 py-1 text-xs ${
              state.enabled
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {state.enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Repeat mode */}
        <div className="space-y-1.5">
          <span className="text-xs text-zinc-300">Chế độ lặp</span>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { mode: 'off', icon: Repeat, label: 'Tắt lặp', slash: true },
                { mode: 'all', icon: Repeat, label: 'Lặp playlist', slash: false },
                { mode: 'one', icon: Repeat1, label: 'Lặp bài này', slash: false },
              ] as {
                mode: RepeatMode;
                icon: typeof Repeat;
                label: string;
                slash: boolean;
              }[]
            ).map(({ mode, icon: Icon, label, slash }) => {
              const active = state.repeatMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => state.setRepeatMode(mode)}
                  title={label}
                  className={`flex items-center justify-center rounded px-2 py-1.5 ${
                    active
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <span className="relative inline-flex">
                    <Icon className="h-3.5 w-3.5" />
                    {slash && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <span
                          className={`block h-[1.5px] w-[120%] rotate-45 rounded-sm ${
                            active ? 'bg-blue-400' : 'bg-current'
                          }`}
                        />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Position */}
        <div className="space-y-1.5">
          <span className="text-xs text-zinc-300">Vị trí cửa sổ</span>
          <div className="grid grid-cols-2 gap-1">
            {POS_ORDER.map((p) => {
              const { label, icon: Icon } = POS_META[p];
              const active = state.position === p;
              return (
                <button
                  key={p}
                  onClick={() => state.setPosition(p)}
                  title={label}
                  className={`flex items-center justify-center rounded px-2 py-1.5 ${
                    active
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Reset size */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-300">Kích thước</span>
          <button
            onClick={() => state.setSize({ width: 280, height: 200 })}
            className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100"
          >
            Reset
          </button>
        </div>

        {/* Volume */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-300">Âm lượng</span>
            <span className="font-mono text-[10px] text-zinc-500">{state.volume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={state.volume}
            onChange={(e) => state.setVolume(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      </div>
    </div>
  );
}