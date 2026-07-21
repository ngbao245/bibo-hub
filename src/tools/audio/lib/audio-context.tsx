import { createContext, useContext, useState, type ReactNode } from 'react';
import { useAudioPlayer, type AudioPlayer } from './audio-player-hook';

interface AudioContextValue {
  player: AudioPlayer;
  /** Floating window có đang hiển thị không (user mở từ trigger). */
  floatingOpen: boolean;
  setFloatingOpen: (v: boolean) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

/**
 * Mount 1 lần ở App root. Tất cả components share cùng state qua context.
 * Mục đích:
 * - 1 instance YT player duy nhất (tránh phát chồng nhạc)
 * - Queue + position + size persist liên tục cross-route
 * - Floating window có thể trigger từ Reader, Notes, Tasks...
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer();
  const [floatingOpen, setFloatingOpen] = useState(false);

  return (
    <AudioContext.Provider value={{ player, floatingOpen, setFloatingOpen }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within <AudioProvider>');
  return ctx;
}