/**
 * YouTube IFrame Player API loader (singleton).
 *
 * Plain <iframe> không expose event onend → không advance queue được.
 * IFrame API cho phép tạo Player object, listen onStateChange (ENDED=0),
 * control playVideo/pauseVideo/loadVideoById từ JS.
 *
 * Reference: https://developers.google.com/youtube/iframe_api_reference
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  setVolume(volume: number): void;
  getVolume(): number;
  getDuration(): number;
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
  getPlayerState(): number;
}

interface YTConstructor {
  new (element: HTMLElement | string, options: YTPlayerOptions): YTPlayer;
}

interface YTPlayerOptions {
  videoId?: string;
  width?: number | string;
  height?: number | string;
  playerVars?: {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    modestbranding?: 0 | 1;
    rel?: 0 | 1;
    playsinline?: 0 | 1;
    /** 3 = không show video annotations */
    iv_load_policy?: 1 | 3;
    /** 0 = ẩn nút fullscreen */
    fs?: 0 | 1;
    /** 1 = disable keyboard shortcut bên trong iframe */
    disablekb?: 0 | 1;
  };
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

interface YTNamespace {
  Player: YTConstructor;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

let loaderPromise: Promise<YTNamespace> | null = null;

/** Load IFrame API 1 lần. Trả về promise resolve YT namespace. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    // Gắn callback global trước khi load script
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YT API loaded but Player not available'));
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load YouTube IFrame API'));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export type { YTPlayer, YTPlayerOptions, YTNamespace };