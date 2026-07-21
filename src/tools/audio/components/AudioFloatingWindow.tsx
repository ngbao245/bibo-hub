import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { useAudio } from '@/tools/audio/lib/audio-context';
import type { AudioPlayer, CornerPosition } from '@/tools/audio/lib/audio-player-hook';
import { loadYouTubeApi, YT_STATE, type YTPlayer } from '@/tools/audio/lib/youtube-api';

interface Props {
  state: AudioPlayer;
  /** True = ẩn UI nhưng vẫn mount iframe (giữ tiếng). */
  hidden?: boolean;
}

const MARGIN = 16;
const MIN_W = 280;
const MIN_H = 200;
const MAX_W_FACTOR = 0.9;
const MAX_H_FACTOR = 0.9;
const DRAG_THRESHOLD = 4;
// Step seek bằng phím: dưới 60s cộng dồn thì +10s mỗi nhấn, qua mốc 60s thì +30s.
const SEEK_STEP_SMALL = 10;
const SEEK_STEP_LARGE = 30;
const SEEK_STEP_THRESHOLD = 60;
// Debounce commit seek bằng phím + giữ preview sau commit.
const SEEK_COMMIT_DEBOUNCE_MS = 400;
const SEEK_PREVIEW_HOLD_MS = 600;
// Volume step khi nhấn ↑/↓.
const VOLUME_STEP = 5;
// Flash toast hiển thị bao lâu.
const FLASH_DURATION_MS = 900;

function posStyle(pos: CornerPosition): React.CSSProperties {
  switch (pos) {
    case 'top-left':
      return { top: MARGIN, left: MARGIN };
    case 'top-right':
      return { top: MARGIN, right: MARGIN };
    case 'bottom-left':
      return { bottom: MARGIN, left: MARGIN };
    case 'bottom-right':
    default:
      return { bottom: MARGIN, right: MARGIN };
  }
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Floating window phát nhạc — luôn mount khi enabled (UI ẩn bằng CSS khi
 * `hidden=true`, NHƯNG iframe vẫn alive để giữ tiếng).
 *
 * - Tạo YT.Player qua IFrame API → listen onStateChange.ENDED để advance queue.
 * - Drag header để đổi vị trí (snap về corner gần nhất khi thả).
 * - Resize handle ở góc đối diện corner đang đứng.
 * - z-40 để dưới Dialog overlay (z-50), tránh đè modal close button.
 */
export default function AudioFloatingWindow({ state, hidden = false }: Props) {
  const { setFloatingOpen } = useAudio();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);
  const lastPlaySignalRef = useRef<number | null>(null);
  const lastPauseSignalRef = useRef<number | null>(null);

  // Refs để tránh stale closure trong event handlers
  const initialVolumeRef = useRef(state.volume);
  const setIsPlayingRef = useRef(state.setIsPlaying);
  const setIsLoadingRef = useRef(state.setIsLoading);
  const handleEndedRef = useRef(state.handleEnded);
  const currentItemRef = useRef(state.currentItem);
  const playSignalRef = useRef(state.playSignal);
  const repeatModeRef = useRef(state.repeatMode);
  const queueLenRef = useRef(state.queue.length);
  setIsPlayingRef.current = state.setIsPlaying;
  setIsLoadingRef.current = state.setIsLoading;
  handleEndedRef.current = state.handleEnded;
  currentItemRef.current = state.currentItem;
  playSignalRef.current = state.playSignal;
  repeatModeRef.current = state.repeatMode;
  queueLenRef.current = state.queue.length;

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startRect: DOMRect;
    active: boolean;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const [resizing, setResizing] = useState(false);
  const [focused, setFocused] = useState(false);

  // Progress state (poll mỗi 500ms khi playing)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekDragging, setSeekDragging] = useState(false);
  const seekDragValueRef = useRef(0);
  // True chỉ khi pointer còn down trên seekbar. `seekDragging` có thể vẫn
  // true thêm 600ms sau pointerup để block poll, nhưng lúc đó pointer move
  // không được update preview (đã thả chuột).
  const seekPointerDownRef = useRef(false);
  // True khi đang accumulate phím (chưa commit) → poll currentTime không overwrite preview.
  const [keySeeking, setKeySeeking] = useState(false);
  // Hover preview trên seekbar — hiện tooltip thời gian phía trên trong vùng video.
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  // Flash toast hiện giữa màn hình ~900ms khi seek bằng phím / chỉnh volume
  type Flash = { kind: 'seek' | 'volume'; primary: string; secondary?: string };
  const [flash, setFlash] = useState<Flash | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seek accumulator (keyboard): signed offset đang chờ commit. -1/+1 = chiều.
  const seekAccumRef = useRef(0);
  const seekDirRef = useRef<-1 | 1 | 0>(0);
  const seekBaseRef = useRef(0); // currentTime tại lúc bắt đầu accumulate
  const seekDurRef = useRef(0);
  const seekCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timer giữ seekDragging=true thêm 600ms sau khi thả chuột để YT seek xong.
  const seekHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tương tự cho key seeking.
  const keyHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { enabled, currentItem, position, size, volume } = state;
  const { setPosition, setSize } = state;

  // ===== YT Player init (1 lần khi enabled) =====
  // Không phụ thuộc `hidden`/`minimized` để iframe persist qua mọi
  // visibility toggle.
  useEffect(() => {
    if (!enabled) {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
        readyRef.current = false;
        loadedVideoIdRef.current = null;
      }
      return;
    }
    if (playerRef.current) return;
    const host = iframeHostRef.current;
    if (!host) return;

    let cancelled = false;
    void loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      if (!iframeHostRef.current) return;
      // YT thay element pass vào bằng iframe → tạo div con để bảo vệ host ref.
      const slot = document.createElement('div');
      iframeHostRef.current.appendChild(slot);
      const startVideoId = currentItemRef.current?.videoId;
      const p = new YT.Player(slot, {
        // % không hợp lệ cho attr width/height → set số, dùng CSS để
        // iframe stretch full container ([&>iframe]:w-full h-full).
        width: '100%',
        height: '100%',
        // Chỉ set videoId khi thật sự có. Truyền undefined → YT widget
        // internal gọi cueVideoById(undefined) → throw "Invalid video id".
        ...(startVideoId ? { videoId: startVideoId } : {}),
        playerVars: {
          autoplay: 0,
          // controls=0 + overlay đè lên iframe → user không tương tác trực tiếp
          // với UI YouTube. Phát/pause/skip qua nút custom của app.
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
        },
        events: {
          onReady: (e) => {
            playerRef.current = e.target;
            readyRef.current = true;
            try {
              e.target.setVolume(initialVolumeRef.current);
            } catch {
              // ignore
            }
            // Sync currentItem ở thời điểm ready (có thể đã đổi khi đợi API load)
            const latestId = currentItemRef.current?.videoId ?? null;
            if (latestId && latestId !== startVideoId) {
              try {
                e.target.loadVideoById(latestId);
              } catch {
                // ignore
              }
              loadedVideoIdRef.current = latestId;
            } else {
              loadedVideoIdRef.current = startVideoId ?? null;
            }
            // Nếu trong lúc chờ ready user đã trigger play → fire ngay
            if (latestId && playSignalRef.current !== lastPlaySignalRef.current) {
              lastPlaySignalRef.current = playSignalRef.current;
              try {
                if (loadedVideoIdRef.current !== latestId) {
                  e.target.loadVideoById(latestId);
                  loadedVideoIdRef.current = latestId;
                } else {
                  e.target.playVideo();
                }
              } catch {
                // ignore
              }
            }
          },
          onStateChange: (e) => {
            if (e.data === YT_STATE.PLAYING) {
              setIsPlayingRef.current(true);
              setIsLoadingRef.current(false);
            } else if (e.data === YT_STATE.BUFFERING) {
              setIsLoadingRef.current(true);
            } else if (e.data === YT_STATE.PAUSED || e.data === YT_STATE.ENDED) {
              setIsPlayingRef.current(false);
              setIsLoadingRef.current(false);
            } else if (e.data === YT_STATE.CUED || e.data === YT_STATE.UNSTARTED) {
              setIsLoadingRef.current(false);
            }
            if (e.data === YT_STATE.ENDED) {
              // Replay nhanh cho case "không advance index" — gọi trực
              // tiếp tại đây vì đi vòng qua React state (handleEnded →
              // playSignal → effect → playVideo) có thể bị React skip
              // effect khi deps không đổi sau lần replay đầu.
              const mode = repeatModeRef.current;
              const qlen = queueLenRef.current;
              const sameSongRepeat = mode === 'one' || (mode === 'all' && qlen <= 1);
              if (sameSongRepeat) {
                try {
                  e.target.seekTo(0, true);
                  e.target.playVideo();
                } catch {
                  // ignore
                }
              } else {
                // Còn lại (advance next, repeat-all wrap khi >1 bài, off):
                // đi qua hook để update currentIndex.
                handleEndedRef.current();
              }
            }
          },
        },
      });
      void p;
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Cleanup khi unmount thật sự (host unmount, vd disable provider)
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
        readyRef.current = false;
      }
    };
  }, []);

  // Sync currentItem → loadVideoById
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    const id = currentItem?.videoId ?? null;
    if (id === null) {
      try {
        p.stopVideo();
      } catch {
        // ignore
      }
      loadedVideoIdRef.current = null;
      return;
    }
    if (loadedVideoIdRef.current === id) return;
    try {
      p.loadVideoById(id);
      loadedVideoIdRef.current = id;
    } catch {
      // ignore
    }
  }, [currentItem]);

  // Volume sync
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      p.setVolume(volume);
    } catch {
      // ignore
    }
  }, [volume]);

  // Play signal
  useEffect(() => {
    // Lần đầu mount: baseline signal, không fire (user chưa bấm play sau khi mount này).
    if (lastPlaySignalRef.current === null) {
      lastPlaySignalRef.current = state.playSignal;
      return;
    }
    if (state.playSignal === lastPlaySignalRef.current) return;
    const p = playerRef.current;
    const id = currentItem?.videoId ?? null;
    if (!id) return;
    // Chưa ready → bật loading, KHÔNG consume signal. onReady sẽ pick up.
    if (!p || !readyRef.current) {
      setIsLoadingRef.current(true);
      return;
    }
    lastPlaySignalRef.current = state.playSignal;
    try {
      if (loadedVideoIdRef.current !== id) {
        // Bài mới → load (onStateChange PLAYING sẽ tắt loading).
        setIsLoadingRef.current(true);
        p.loadVideoById(id);
        loadedVideoIdRef.current = id;
      } else {
        let yState: number = YT_STATE.UNSTARTED;
        try {
          yState = p.getPlayerState();
        } catch {
          // ignore
        }
        // Cùng bài (repeat-one, repeat-all wrap về cùng index, next/prev
        // trên queue 1 bài).
        if (yState === YT_STATE.PLAYING || yState === YT_STATE.BUFFERING) {
          try {
            p.seekTo(0, true);
          } catch {
            // ignore
          }
        } else if (yState === YT_STATE.ENDED) {
          // Một số phiên bản YT player sau ENDED không tự replay khi
          // gọi playVideo(); ép seek 0 trước.
          try {
            p.seekTo(0, true);
          } catch {
            // ignore
          }
        }
        try {
          p.playVideo();
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, [state.playSignal, currentItem]);

  // Pause signal
  useEffect(() => {
    if (lastPauseSignalRef.current === null) {
      lastPauseSignalRef.current = state.pauseSignal;
      return;
    }
    if (state.pauseSignal === lastPauseSignalRef.current) return;
    lastPauseSignalRef.current = state.pauseSignal;
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      p.pauseVideo();
    } catch {
      // ignore
    }
  }, [state.pauseSignal]);

  // Poll currentTime / duration mỗi 500ms khi playing. Khi pause/stop thì
  // ngừng poll để khỏi tốn CPU; duration vẫn giữ giá trị cuối để seekbar
  // không nhảy về 0.
  useEffect(() => {
    if (!state.isPlaying) return;
    const tick = () => {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      try {
        const d = p.getDuration() || 0;
        const c = p.getCurrentTime() || 0;
        if (d > 0) setDuration(d);
        // Không overwrite preview khi user đang drag seekbar hoặc đang accumulate phím
        if (!seekDragging && !keySeeking) setCurrentTime(c);
      } catch {
        // ignore
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [state.isPlaying, seekDragging, keySeeking]);

  // Reset progress khi đổi bài
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [currentItem?.videoId]);

  // ===== Drag handlers =====
  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRect: el.getBoundingClientRect(),
      active: false,
    };
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      drag.active = true;
      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    setDragOffset({ x: dx, y: dy });
  }, []);

  const onDragEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const target = e.currentTarget;
      try {
        if (target.hasPointerCapture(e.pointerId)) {
          target.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      if (!drag || !drag.active) {
        dragRef.current = null;
        return;
      }
      const r = drag.startRect;
      const centerX = r.left + (e.clientX - drag.startX) + r.width / 2;
      const centerY = r.top + (e.clientY - drag.startY) + r.height / 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isRight = centerX > vw / 2;
      const isBottom = centerY > vh / 2;
      const snap: CornerPosition = isBottom
        ? isRight
          ? 'bottom-right'
          : 'bottom-left'
        : isRight
          ? 'top-right'
          : 'top-left';
      setPosition(snap);
      dragRef.current = null;
      setDragOffset(null);
    },
    [setPosition],
  );

  // ===== Resize handlers =====
  const onResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: size.width,
        startH: size.height,
      };
      setResizing(true);
    },
    [size.width, size.height],
  );

  const onResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const r = resizeRef.current;
      if (!r) return;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      const isRight = position.includes('right');
      const isBottom = position.includes('bottom');
      const maxW = window.innerWidth * MAX_W_FACTOR;
      const maxH = window.innerHeight * MAX_H_FACTOR;
      const nextW = Math.max(MIN_W, Math.min(maxW, r.startW + (isRight ? -dx : dx)));
      const nextH = Math.max(MIN_H, Math.min(maxH, r.startH + (isBottom ? -dy : dy)));
      setSize({ width: nextW, height: nextH });
    },
    [position, setSize],
  );

  const onResizeEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    try {
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    resizeRef.current = null;
    setResizing(false);
  }, []);

  // Khi window chuyển sang hidden → blur container để hết focused state +
  // không nhận keydown sai context. (Phím cũng đã guard trong onKeyDown.)
  // Khi mở lại (hidden → false) → auto focus để user dùng phím ngay,
  // khỏi phải click thêm.
  useEffect(() => {
    if (hidden) {
      containerRef.current?.blur();
      setFocused(false);
    } else {
      // Đợi 1 frame để layout/style transition xong rồi focus, tránh
      // browser bỏ qua focus trên element vừa rời off-screen.
      const id = requestAnimationFrame(() => containerRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [hidden]);

  // ===== Misc handlers (callbacks dùng trong JSX) =====
  const showFlash = useCallback((next: Flash) => {
    setFlash(next);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), FLASH_DURATION_MS);
  }, []);

  // Cleanup tất cả timers khi unmount
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (seekCommitTimerRef.current) clearTimeout(seekCommitTimerRef.current);
      if (seekHoldTimerRef.current) clearTimeout(seekHoldTimerRef.current);
      if (keyHoldTimerRef.current) clearTimeout(keyHoldTimerRef.current);
    };
  }, []);

  // ===== Toggle play/pause với handle case ENDED =====
  // Nếu YT player ở state ENDED (vd repeat-off vừa hết queue) — gọi
  // playVideo() / state.play() có thể không kick player; tự seekTo(0)+
  // playVideo() trực tiếp cho chắc.
  const togglePlayPause = useCallback(() => {
    if (state.queue.length === 0 || state.isLoading) return;
    const p = playerRef.current;
    if (p && readyRef.current) {
      try {
        if (p.getPlayerState() === YT_STATE.ENDED) {
          p.seekTo(0, true);
          p.playVideo();
          // Nếu currentIndex = -1 (đã set khi handleEnded repeat-off) thì
          // cũng đồng bộ React state về currentIndex 0.
          if (!state.currentItem) state.play();
          return;
        }
      } catch {
        // ignore
      }
    }
    if (state.isPlaying) state.pause();
    else state.play();
  }, [state]);

  // ===== Seekbar handlers =====
  const seekTo = useCallback((seconds: number) => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      p.seekTo(Math.max(0, seconds), true);
    } catch {
      // ignore
    }
  }, []);

  if (!enabled) return null;

  // Khi `hidden` → render off-screen (vẫn mount, vẫn phát tiếng).
  // Visibility hidden không đủ vì iframe có thể bị browser deprioritize;
  // dùng position absolute + opacity 0 + pointer-events: none.
  const isHiddenForUser = hidden;

  const containerStyle: React.CSSProperties = isHiddenForUser
    ? {
      position: 'fixed',
      left: -9999,
      top: -9999,
      width: size.width,
      height: size.height,
      opacity: 0,
      pointerEvents: 'none',
    }
    : {
      position: 'fixed',
      ...posStyle(position),
      width: size.width,
      height: size.height,
      transform: dragOffset
        ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
        : undefined,
      transition: dragOffset
        ? 'none'
        : 'top 0.18s, left 0.18s, right 0.18s, bottom 0.18s',
    };

  const resizeHandleCursor =
    position === 'top-left'
      ? 'se-resize'
      : position === 'top-right'
        ? 'sw-resize'
        : position === 'bottom-left'
          ? 'ne-resize'
          : 'nw-resize';
  const resizeHandlePos: React.CSSProperties = {
    [position.includes('top') ? 'bottom' : 'top']: 0,
    [position.includes('left') ? 'right' : 'left']: 0,
    cursor: resizeHandleCursor,
  };

  // ===== Keyboard shortcuts (chỉ active khi window focus) =====
  // Space: toggle play/pause.
  // ←/→: seek với cộng dồn. Step 10s khi |accum| < 60, sau đó 30s.
  //      Đổi chiều → reset. Debounce 400ms idle mới commit seek thật.
  // ↑/↓: volume ±5.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Khi window đang ẩn (thu gọn), bỏ qua mọi phím — tránh user thao
    // tác "vô hình" lên player mà không thấy phản hồi UI.
    if (hidden) return;
    // Khi user đang focus vào input/textarea/contentEditable bên trong
    // container, đừng intercept phím (sẽ break gõ chữ, Space khi nhập...).
    const target = e.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }
    }
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      e.preventDefault();

      const dir: -1 | 1 = e.key === 'ArrowLeft' ? -1 : 1;
      // Đổi chiều hoặc bắt đầu mới → reset baseline + accum
      if (seekDirRef.current !== dir) {
        seekDirRef.current = dir;
        seekAccumRef.current = 0;
        try {
          seekBaseRef.current = p.getCurrentTime() || 0;
          seekDurRef.current = p.getDuration() || 0;
        } catch {
          // ignore
        }
      }

      const currentAbs = Math.abs(seekAccumRef.current);
      const step = currentAbs < SEEK_STEP_THRESHOLD ? SEEK_STEP_SMALL : SEEK_STEP_LARGE;
      const newAbs = currentAbs + step;
      const proposedAccum = dir * newAbs;

      const dur = seekDurRef.current;
      const rawTarget = seekBaseRef.current + proposedAccum;
      const target = dur > 0 ? clamp(rawTarget, 0, dur) : Math.max(0, rawTarget);
      // Clamp accum theo target thực — không cho nhấn vô hạn vượt qua
      // [0, dur]. effectiveAccum = target - base.
      const effectiveAccum = target - seekBaseRef.current;
      seekAccumRef.current = effectiveAccum;
      const displayAbs = Math.round(Math.abs(effectiveAccum));

      // Preview trên seekbar
      setCurrentTime(target);
      setKeySeeking(true);
      showFlash({
        kind: 'seek',
        primary: `${effectiveAccum >= 0 ? '+' : '−'}${displayAbs}s`,
        secondary: dur > 0 ? `${formatTime(target)} / ${formatTime(dur)}` : formatTime(target),
      });

      // Debounce commit
      if (seekCommitTimerRef.current) clearTimeout(seekCommitTimerRef.current);
      seekCommitTimerRef.current = setTimeout(() => {
        const player = playerRef.current;
        if (player && readyRef.current) {
          try {
            player.seekTo(target, true);
          } catch {
            // ignore
          }
        }
        seekAccumRef.current = 0;
        seekDirRef.current = 0;
        // Giữ preview thêm 600ms sau commit để YT seek xong rồi mới cho
        // poll overwrite — tránh seekbar nháy về vị trí cũ.
        if (keyHoldTimerRef.current) clearTimeout(keyHoldTimerRef.current);
        keyHoldTimerRef.current = setTimeout(() => setKeySeeking(false), SEEK_PREVIEW_HOLD_MS);
      }, SEEK_COMMIT_DEBOUNCE_MS);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = e.key === 'ArrowUp' ? VOLUME_STEP : -VOLUME_STEP;
      const nextVol = clamp(state.volume + delta, 0, 100);
      state.setVolume(nextVol);
      showFlash({ kind: 'volume', primary: `${nextVol}%` });
    }
  };

  // Hover preview handlers cho seekbar
  const onSeekHoverMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const r = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    setHoverRatio(r);
  };
  const onSeekHoverLeave = () => setHoverRatio(null);

  const onSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    seekPointerDownRef.current = true;
    setSeekDragging(true);
    // Hủy timer giữ preview cũ nếu user bấm lại trong khi đang hold.
    if (seekHoldTimerRef.current) {
      clearTimeout(seekHoldTimerRef.current);
      seekHoldTimerRef.current = null;
    }
    const rect = target.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const t = ratio * duration;
    seekDragValueRef.current = t;
    setCurrentTime(t);
  };

  const onSeekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Cập nhật hover preview luôn (không chỉ khi drag) để tooltip follow.
    onSeekHoverMove(e);
    // Chỉ update preview khi pointer còn DOWN — không follow chuột trong
    // giai đoạn 600ms hold sau khi đã thả.
    if (!seekPointerDownRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const t = ratio * duration;
    seekDragValueRef.current = t;
    setCurrentTime(t);
  };

  const onSeekPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    try {
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (!seekPointerDownRef.current) return;
    seekPointerDownRef.current = false;
    const t = seekDragValueRef.current;
    seekTo(t);
    // Giữ preview thêm 600ms để YT seek xong rồi mới cho poll overwrite.
    setCurrentTime(t);
    if (seekHoldTimerRef.current) clearTimeout(seekHoldTimerRef.current);
    seekHoldTimerRef.current = setTimeout(
      () => setSeekDragging(false),
      SEEK_PREVIEW_HOLD_MS,
    );
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onPointerDownCapture={() => {
        // Bất kỳ click nào trong window → refocus container sau khi
        // browser xử lý default. Dùng rAF để chạy sau focus shift của
        // button mặc định.
        requestAnimationFrame(() => containerRef.current?.focus());
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      className={`z-40 flex select-none flex-col overflow-hidden rounded-lg border bg-zinc-900 shadow-2xl outline-none transition-colors ${focused ? 'border-zinc-600' : 'border-zinc-800'
        }`}
      style={containerStyle}
      aria-hidden={isHiddenForUser}
    >
      {/* Header: drag + controls */}
      <div
        className="flex shrink-0 cursor-grab touch-none select-none items-center gap-1 border-b border-zinc-800 bg-zinc-950/80 px-2 py-1.5 active:cursor-grabbing"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <span
          className="min-w-0 flex-1 truncate text-[11px] text-zinc-300"
          title={currentItem?.title}
        >
          {currentItem ? currentItem.title : 'Chưa chọn bài'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Đóng cửa sổ KHÔNG dừng nhạc — vẫn còn mini launcher icon
            // (AudioFloatingHost) để mở lại.
            setFloatingOpen(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded p-1 text-zinc-500 hover:text-red-400"
          title="Đóng cửa sổ (nhạc tiếp tục)"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* YouTube iframe container + overlay shield */}
      <div className="relative flex-1 bg-zinc-950">
        <div
          ref={iframeHostRef}
          className="absolute inset-0 [&>div]:h-full [&>div]:w-full [&>iframe]:h-full [&>iframe]:w-full"
        />
        {/* Overlay click area: click → toggle play/pause. Trong suốt 100%,
            chỉ là div phủ toàn bộ để bắt click (dùng div thay button để
            khỏi steal focus khỏi container — keyboard shortcut cần focus
            ở container outer). */}
        <div
          role="button"
          tabIndex={-1}
          onClick={togglePlayPause}
          className={`pointer-events-auto absolute inset-0 ${state.queue.length === 0 || state.isLoading ? 'cursor-default' : 'cursor-pointer'
            }`}
          aria-label={state.isPlaying ? 'Tạm dừng' : 'Phát'}
        />

        {/* Flash toast — feedback khi seek bằng phím / chỉnh volume.
            Font + padding scale theo width window để cân với kích thước. */}
        {flash && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="flex flex-col items-center rounded-lg bg-zinc-950/85 text-zinc-100 shadow-lg backdrop-blur-sm"
              style={{
                paddingInline: `${Math.max(6, Math.min(12, size.width * 0.028))}px`,
                paddingBlock: `${Math.max(2, Math.min(5, size.width * 0.01))}px`,
                gap: `${Math.max(0, Math.min(2, size.width * 0.003))}px`,
                minWidth: `${Math.max(40, Math.min(72, size.width * 0.16))}px`,
              }}
            >
              <span
                className="font-mono font-semibold tabular-nums leading-tight"
                style={{
                  fontSize: `${Math.max(9, Math.min(14, size.width * 0.035))}px`,
                }}
              >
                {flash.primary}
              </span>
              {flash.secondary && (
                <span
                  className="font-mono tabular-nums leading-tight text-zinc-400"
                  style={{
                    fontSize: `${Math.max(7, Math.min(9, size.width * 0.018))}px`,
                  }}
                >
                  {flash.secondary}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Seekbar */}
      <div className="flex shrink-0 items-center gap-2 border-t border-zinc-800 bg-zinc-950/80 px-2 py-1">
        <span className="font-mono text-[10px] tabular-nums text-zinc-500">
          {formatTime(currentTime)}
        </span>
        <div
          className="group relative h-3 flex-1 cursor-pointer touch-none"
          onPointerDown={onSeekPointerDown}
          onPointerMove={onSeekPointerMove}
          onPointerUp={onSeekPointerUp}
          onPointerCancel={onSeekPointerUp}
          onPointerEnter={onSeekHoverMove}
          onPointerLeave={onSeekHoverLeave}
        >
          <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-800" />
          <div
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-400 group-hover:bg-zinc-200"
            style={{
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
            }}
          />
          {/* Hover tooltip — nổi lên phía trên seekbar, đè vào đáy vùng video */}
          {hoverRatio !== null && duration > 0 && (
            <div
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-zinc-950/90 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-zinc-100 shadow-lg backdrop-blur-sm"
              style={{ left: `${hoverRatio * 100}%` }}
            >
              {formatTime(hoverRatio * duration)}
            </div>
          )}
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-100 opacity-0 shadow group-hover:opacity-100"
            style={{
              left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
              opacity: seekDragging ? 1 : undefined,
            }}
          />
        </div>
        <span className="font-mono text-[10px] tabular-nums text-zinc-500">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center justify-center gap-1 border-t border-zinc-800 bg-zinc-950/80 px-2 py-1.5">
        <button
          onClick={state.prev}
          disabled={state.queue.length === 0}
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
          title="Bài trước"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={togglePlayPause}
          disabled={state.queue.length === 0 || state.isLoading}
          className="rounded p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
          title={state.isLoading ? 'Đang tải...' : state.isPlaying ? 'Tạm dừng' : 'Phát'}
        >
          {state.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={state.next}
          disabled={state.queue.length === 0}
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
          title="Bài sau"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
        <span className="ml-auto text-[10px] text-zinc-500">
          {state.queue.length > 0
            ? `${state.currentIndex >= 0 ? state.currentIndex + 1 : 0}/${state.queue.length}`
            : '0/0'}
        </span>
      </div>

      {/* Resize handle — double-click để reset size về default */}
      <div
        className="absolute h-4 w-4 touch-none"
        style={resizeHandlePos}
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        onDoubleClick={() => setSize({ width: 280, height: 200 })}
        title="Kéo để resize • Double-click để reset"
      />

      {/* Size overlay khi đang resize */}
      {resizing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-md border border-zinc-700 bg-zinc-900/85 px-3 py-1.5 font-mono text-xs text-zinc-100 shadow-lg backdrop-blur-sm">
            {Math.round(size.width)} × {Math.round(size.height)}
          </div>
        </div>
      )}
    </div>
  );
}