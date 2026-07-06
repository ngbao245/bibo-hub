import { useRef } from 'react';
import { ArrowDown } from 'lucide-react';
import { PolygonBackground } from '@/components/polygon-3d/PolygonBackground';
import { usePauseWhenHidden } from '@/hooks/usePauseWhenHidden';
import { useScrollActive } from '@/hooks/useScrollActive';
import { cn } from '@/lib/cn';
import { HERO } from './content';

// ============================================================
// Hero — 100vh, polygon 3D bg + tên + tagline + CTA.
// ============================================================
//
// Pause signals (combined OR):
//   - usePauseWhenHidden threshold 0.3 — Hero <30% visible
//   - useScrollActive — user đang scroll (freeze scene để GPU
//     bandwidth dồn cho browser compositor, tránh jank scroll)
//
// CTA button: solid dark, không backdrop-blur (blur re-composite
// mỗi frame scroll là 1 nguồn jank).
//
// ArrowDown bounce: chỉ animate khi hero active (không pause).
// ============================================================

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const hidden = usePauseWhenHidden(heroRef, { threshold: 0.3 });
  const scrolling = useScrollActive();
  const paused = hidden || scrolling;

  const scrollToServices = () => {
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-black"
    >
      <PolygonBackground variant="fullscreen" paused={paused} />

      {/* Overlay content center */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <h1 className="text-5xl font-light tracking-tight text-zinc-100 md:text-7xl">
          {HERO.name}
        </h1>
        <p className="mt-6 max-w-xl text-base text-zinc-400 md:text-lg">{HERO.tagline}</p>
        <button
          onClick={scrollToServices}
          className="mt-10 inline-flex items-center gap-2 border border-zinc-700 bg-zinc-900/80 px-6 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
        >
          {HERO.ctaLabel}
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      {/* Scroll hint bottom — bounce chỉ khi hero active */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-zinc-500">
        <ArrowDown className={cn('h-4 w-4', !paused && 'animate-bounce')} />
      </div>
    </section>
  );
}