// ============================================================
// PDF Studio Edit PDF — Markup tools (Highlight, Pencil, Eraser)
// ============================================================
// Highlight: drag to create semi-transparent rectangle region
// Pencil: freehand SVG path
// Eraser: click overlay objects to delete them (not PDF content)
// ============================================================

import { useRef, useCallback, useState } from 'react';
import type { ViewportTransform, PathObject } from '../../lib/editor-objects';
import { createId, screenToDoc, scaleToScreen } from '../../lib/editor-objects';
import { useEditorStore } from '../../lib/useEditorStore';

export type MarkupMode = 'highlight' | 'pencil' | 'eraser' | null;

interface MarkupToolsProps {
  mode: MarkupMode;
  transform: ViewportTransform;
  pageId: string;
  color: string;
  strokeWidth: number;
}

export function MarkupTools({ mode, transform, pageId, color, strokeWidth }: MarkupToolsProps) {
  const { objects, addObject, deleteObjects, startGesture, commitGesture } = useEditorStore();
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [highlightStart, setHighlightStart] = useState<{ x: number; y: number } | null>(null);
  const [highlightEnd, setHighlightEnd] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getDocCoords = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { docX: 0, docY: 0 };
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return screenToDoc(screenX + transform.offsetX, screenY + transform.offsetY, transform);
  }, [transform]);

  // ─── Pencil ────────────────────────────────────────────────

  const handlePencilDown = useCallback((e: React.PointerEvent) => {
    if (mode !== 'pencil') return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const { docX, docY } = getDocCoords(e);
    setDrawing(true);
    setCurrentPoints([{ x: docX, y: docY }]);
    startGesture();
  }, [mode, getDocCoords, startGesture]);

  const handlePencilMove = useCallback((e: React.PointerEvent) => {
    if (!drawing || mode !== 'pencil') return;
    const { docX, docY } = getDocCoords(e);
    setCurrentPoints((prev) => [...prev, { x: docX, y: docY }]);
  }, [drawing, mode, getDocCoords]);

  const handlePencilUp = useCallback(() => {
    if (!drawing || mode !== 'pencil') return;
    setDrawing(false);
    if (currentPoints.length < 2) {
      setCurrentPoints([]);
      return;
    }

    // Calculate bounds
    const xs = currentPoints.map((p) => p.x);
    const ys = currentPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const pathObj: PathObject = {
      id: createId(),
      type: 'path',
      pageId,
      x: minX,
      y: minY,
      width: maxX - minX || 1,
      height: maxY - minY || 1,
      rotation: 0,
      opacity: 100,
      layerOrder: Date.now(),
      locked: false,
      points: currentPoints,
      color,
      strokeWidth,
    };

    addObject(pathObj);
    commitGesture('Draw pencil path');
    setCurrentPoints([]);
  }, [drawing, mode, currentPoints, pageId, color, strokeWidth, addObject, commitGesture]);

  // ─── Highlight ─────────────────────────────────────────────

  const handleHighlightDown = useCallback((e: React.PointerEvent) => {
    if (mode !== 'highlight') return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const { docX, docY } = getDocCoords(e);
    setHighlightStart({ x: docX, y: docY });
    setHighlightEnd({ x: docX, y: docY });
    setDrawing(true);
    startGesture();
  }, [mode, getDocCoords, startGesture]);

  const handleHighlightMove = useCallback((e: React.PointerEvent) => {
    if (!drawing || mode !== 'highlight') return;
    const { docX, docY } = getDocCoords(e);
    setHighlightEnd({ x: docX, y: docY });
  }, [drawing, mode, getDocCoords]);

  const handleHighlightUp = useCallback(() => {
    if (!drawing || mode !== 'highlight' || !highlightStart || !highlightEnd) return;
    setDrawing(false);

    const x = Math.min(highlightStart.x, highlightEnd.x);
    const y = Math.min(highlightStart.y, highlightEnd.y);
    const w = Math.abs(highlightEnd.x - highlightStart.x);
    const h = Math.abs(highlightEnd.y - highlightStart.y);

    if (w < 3 && h < 3) {
      setHighlightStart(null);
      setHighlightEnd(null);
      return;
    }

    const highlightObj: PathObject = {
      id: createId(),
      type: 'highlight',
      pageId,
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      opacity: 40,
      layerOrder: Date.now(),
      locked: false,
      points: [], // highlight uses bounds, not path points
      color,
      strokeWidth: 0,
    };

    addObject(highlightObj);
    commitGesture('Add highlight');
    setHighlightStart(null);
    setHighlightEnd(null);
  }, [drawing, mode, highlightStart, highlightEnd, pageId, color, addObject, commitGesture]);

  // ─── Eraser ────────────────────────────────────────────────

  const handleEraserClick = useCallback((e: React.PointerEvent) => {
    if (mode !== 'eraser') return;
    const { docX, docY } = getDocCoords(e);

    // Find the topmost object at this position on this page
    const pageObjects = objects
      .filter((o) => o.pageId === pageId)
      .sort((a, b) => b.layerOrder - a.layerOrder);

    for (const obj of pageObjects) {
      const inX = docX >= obj.x && docX <= obj.x + obj.width;
      const inY = docY >= obj.y && docY <= obj.y + obj.height;
      if (inX && inY) {
        deleteObjects([obj.id]);
        return;
      }
    }
  }, [mode, getDocCoords, objects, pageId, deleteObjects]);

  // ─── Pointer event dispatch ────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (mode === 'pencil') handlePencilDown(e);
    else if (mode === 'highlight') handleHighlightDown(e);
    else if (mode === 'eraser') handleEraserClick(e);
  }, [mode, handlePencilDown, handleHighlightDown, handleEraserClick]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (mode === 'pencil') handlePencilMove(e);
    else if (mode === 'highlight') handleHighlightMove(e);
  }, [mode, handlePencilMove, handleHighlightMove]);

  const handlePointerUp = useCallback(() => {
    if (mode === 'pencil') handlePencilUp();
    else if (mode === 'highlight') handleHighlightUp();
  }, [mode, handlePencilUp, handleHighlightUp]);

  if (!mode) return null;

  const svgWidth = scaleToScreen(transform.pageWidth, transform.scale);
  const svgHeight = scaleToScreen(transform.pageHeight, transform.scale);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-auto"
      // z-index 4 để nằm trên textLayer (z-2) + OverlayLayer (z-3) → capture drag đúng
      style={{ cursor: mode === 'eraser' ? 'crosshair' : 'default', zIndex: 4 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Live pencil preview */}
      {mode === 'pencil' && drawing && currentPoints.length > 1 && (
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={svgWidth}
          height={svgHeight}
        >
          <polyline
            points={currentPoints
              .map((p) => `${p.x * transform.scale},${p.y * transform.scale}`)
              .join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={1}
          />
        </svg>
      )}

      {/* Live highlight preview */}
      {mode === 'highlight' && drawing && highlightStart && highlightEnd && (
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={svgWidth}
          height={svgHeight}
        >
          <rect
            x={Math.min(highlightStart.x, highlightEnd.x) * transform.scale}
            y={Math.min(highlightStart.y, highlightEnd.y) * transform.scale}
            width={Math.abs(highlightEnd.x - highlightStart.x) * transform.scale}
            height={Math.abs(highlightEnd.y - highlightStart.y) * transform.scale}
            fill={color}
            opacity={0.4}
          />
        </svg>
      )}
    </div>
  );
}
