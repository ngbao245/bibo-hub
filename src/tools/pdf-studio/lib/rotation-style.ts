// ============================================================
// PDF Studio — Rotation style helper
// ============================================================
// PDF page hầu hết là A4 ratio (h/w = √2). Khi rotate 90°/270°
// visual thành landscape → thò ra khỏi container portrait → bị crop.
// Fix: scale 1/√2 (~0.7071) để visual fit lại container.
// Kèm transition 300ms cho smooth animate.
// ============================================================

import type { CSSProperties } from 'react';

const SIDEWAYS_SCALE = 0.7071; // 1/√2 — A4 aspect ratio compensator

/**
 * Style cho canvas/img rotate:
 * - Auto-scale khi rotate ±90° để fit container không bị crop
 * - Transition 300ms ease-out
 */
export function getRotationStyle(rotation: number, extra?: CSSProperties): CSSProperties {
  const angle = ((rotation % 360) + 360) % 360;
  const isSideways = angle === 90 || angle === 270;
  return {
    transform: `rotate(${rotation}deg)${isSideways ? ` scale(${SIDEWAYS_SCALE})` : ''}`,
    transition: 'transform 180ms ease-out',
    transformOrigin: 'center center',
    ...extra,
  };
}
