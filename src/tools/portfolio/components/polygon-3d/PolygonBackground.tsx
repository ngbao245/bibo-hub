import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { createScene, type SceneHandle } from '@/tools/portfolio/lib/polygon-3d/scene';
import { detectDeviceTier, prefersReducedMotion } from '@/tools/portfolio/lib/polygon-3d/deviceCapability';

// ============================================================
// PolygonBackground — React wrapper cho three.js scene.
// ============================================================
//
// Skip init hoàn toàn khi prefers-reduced-motion → fallback gradient.
// Fork quality theo device tier (xem lib/polygon-3d/deviceCapability.ts).
// Defer init qua requestIdleCallback → không block first paint.
//
// Fallback gradient khi:
//   - prefers-reduced-motion match, HOẶC
//   - WebGL init throw exception
//
// Props:
//   variant='fullscreen' | 'contained'
//   paused — external control (từ usePauseWhenHidden)
//   className — thêm class ngoài
// ============================================================

interface PolygonBackgroundProps {
  variant: 'fullscreen' | 'contained';
  paused?: boolean;
  className?: string;
}

const FALLBACK_GRADIENT_CLASS =
  'bg-[radial-gradient(ellipse_at_center,_theme(colors.slate.900)_0%,_theme(colors.zinc.950)_50%,_black_100%)]';

export function PolygonBackground({ variant, paused = false, className }: PolygonBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const [failed, setFailed] = useState(false);

  // Reduced motion check 1 lần khi mount — không react runtime change (theo AC US-1).
  // useState init function chạy 1 lần, không re-check khi user toggle OS preference.
  const [skipMotion] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (skipMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: number | undefined;

    const runInit = () => {
      if (cancelled) return;
      try {
        const tier = detectDeviceTier();
        handleRef.current = createScene(canvas, { tier });
      } catch {
        setFailed(true);
      }
    };

    // Defer init sau first paint — không block LCP text/CTA
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(runInit, { timeout: 500 });
    } else {
      timeoutId = window.setTimeout(runInit, 0);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [skipMotion]);

  useEffect(() => {
    handleRef.current?.setPaused(paused);
  }, [paused]);

  const baseClass = variant === 'fullscreen' ? 'absolute inset-0' : 'h-full w-full';

  if (skipMotion || failed) {
    return <div className={cn(baseClass, FALLBACK_GRADIENT_CLASS, className)} aria-hidden />;
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn(baseClass, 'block bg-black', className)}
      aria-hidden
    />
  );
}