// ============================================================
// PDF Studio Edit PDF — SVG Overlay Layer
// ============================================================
// Renders editor objects as SVG elements over the PDF canvas.
// Handles selection, move, resize and rotate via mouse/pointer events.
// All coordinates in document space, transformed via viewport.
// ============================================================

import { useRef, useCallback, useState } from 'react';
import type { EditorObject, ViewportTransform } from '../../lib/editor-objects';
import { docToScreen, scaleToScreen } from '../../lib/editor-objects';
import { useEditorStore } from '../../lib/useEditorStore';

interface OverlayLayerProps {
  objects: EditorObject[];
  pageId: string;
  transform: ViewportTransform;
  activeTool: string | null;
}

export function OverlayLayer({ objects, pageId, transform, activeTool }: OverlayLayerProps) {
  const {
    selectedIds,
    select,
    clearSelection,
    updateObject,
    deleteObjects,
    startGesture,
    commitGesture,
  } = useEditorStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; objX: number; objY: number } | null>(null);

  // Filter objects for current page
  const pageObjects = objects.filter((o) => o.pageId === pageId);

  // Object interactive khi ở default state (không có tool active) HOẶC 'move' tool.
  // Khi user chọn drawing tool (add-text, rectangle...), objects tạm inert để click
  // trên stage tạo object mới, không select cái cũ.
  const interactive = activeTool === null || activeTool === 'move';

  const handleObjectClick = useCallback((e: React.MouseEvent, obj: EditorObject) => {
    e.stopPropagation();
    if (!interactive) return;
    if (e.shiftKey) {
      const newIds = selectedIds.includes(obj.id)
        ? selectedIds.filter((id) => id !== obj.id)
        : [...selectedIds, obj.id];
      select(newIds);
    } else {
      select([obj.id]);
    }
  }, [interactive, selectedIds, select]);

  const handlePointerDown = useCallback((e: React.PointerEvent, obj: EditorObject) => {
    if (!interactive) return;
    if (!selectedIds.includes(obj.id)) return;
    e.stopPropagation();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    startGesture(); // ← wire history capture
    setDragging({ id: obj.id, startX: e.clientX, startY: e.clientY, objX: obj.x, objY: obj.y });
  }, [interactive, selectedIds, startGesture]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragging.startX) / transform.scale;
    const dy = (e.clientY - dragging.startY) / transform.scale;
    updateObject(dragging.id, { x: dragging.objX + dx, y: dragging.objY + dy });
  }, [dragging, transform.scale, updateObject]);

  const handlePointerUp = useCallback(() => {
    if (dragging) {
      commitGesture('Move object'); // ← 1 history entry cho toàn drag
      setDragging(null);
    }
  }, [dragging, commitGesture]);

  // Keyboard delete
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
      e.preventDefault();
      deleteObjects(selectedIds);
    }
    if (e.key === 'Escape') {
      clearSelection();
    }
  }, [selectedIds, deleteObjects, clearSelection]);

  // SVG dimensions match viewport
  const svgWidth = scaleToScreen(transform.pageWidth, transform.scale);
  const svgHeight = scaleToScreen(transform.pageHeight, transform.scale);

  return (
    <svg
      ref={svgRef}
      className="absolute top-0 left-0"
      width={svgWidth}
      height={svgHeight}
      // SVG pointer-events: none → click empty area rơi xuống textLayer (select text PDF)
      // Từng object g bên trong tự set pointer-events: auto khi interactive để capture click
      // z-index 3 vượt textLayer (z-2) — object VẼ đè lên textLayer, nhưng vẫn cho click xuyên qua
      style={{
        width: svgWidth,
        height: svgHeight,
        pointerEvents: 'none',
        zIndex: 3,
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {pageObjects
        .sort((a, b) => a.layerOrder - b.layerOrder)
        .map((obj) => {
          const { screenX, screenY } = docToScreen(obj.x, obj.y, transform);
          const w = scaleToScreen(obj.width, transform.scale);
          const h = scaleToScreen(obj.height, transform.scale);
          const isSelected = selectedIds.includes(obj.id);

          return (
            <g
              key={obj.id}
              transform={`translate(${screenX - transform.offsetX}, ${screenY - transform.offsetY})`}
              opacity={obj.opacity / 100}
              onClick={(e) => handleObjectClick(e, obj)}
              onPointerDown={(e) => handlePointerDown(e, obj)}
              className="cursor-move"
              style={{ pointerEvents: interactive ? 'auto' : 'none' }}
            >
              {/* Object shape */}
              {obj.type === 'shape' && obj.shapeKind === 'rectangle' && (
                <rect
                  width={w}
                  height={h}
                  fill={obj.fillColor}
                  stroke={obj.strokeColor}
                  strokeWidth={obj.strokeWidth}
                  transform={`rotate(${obj.rotation} ${w / 2} ${h / 2})`}
                />
              )}
              {obj.type === 'shape' && obj.shapeKind === 'ellipse' && (
                <ellipse
                  cx={w / 2}
                  cy={h / 2}
                  rx={w / 2}
                  ry={h / 2}
                  fill={obj.fillColor}
                  stroke={obj.strokeColor}
                  strokeWidth={obj.strokeWidth}
                />
              )}
              {obj.type === 'shape' && obj.shapeKind === 'line' && (
                <line
                  x1={0}
                  y1={h / 2}
                  x2={w}
                  y2={h / 2}
                  stroke={obj.strokeColor}
                  strokeWidth={obj.strokeWidth}
                />
              )}
              {obj.type === 'shape' && obj.shapeKind === 'arrow' && (
                <g>
                  <line x1={0} y1={h / 2} x2={w - 8} y2={h / 2} stroke={obj.strokeColor} strokeWidth={obj.strokeWidth} />
                  <polygon points={`${w},${h / 2} ${w - 10},${h / 2 - 5} ${w - 10},${h / 2 + 5}`} fill={obj.strokeColor} />
                </g>
              )}
              {obj.type === 'text' && (
                <foreignObject width={w} height={h}>
                  <div
                    className="w-full h-full flex items-center overflow-hidden text-ellipsis"
                    style={{
                      fontFamily: obj.fontFamily,
                      fontSize: obj.fontSize * transform.scale,
                      fontWeight: obj.fontWeight,
                      fontStyle: obj.fontStyle,
                      color: obj.color,
                      textAlign: obj.align,
                    }}
                  >
                    {obj.content || 'Text'}
                  </div>
                </foreignObject>
              )}
              {obj.type === 'symbol' && obj.symbolKind === 'check' && (
                <polyline
                  points={`${w * 0.2},${h * 0.5} ${w * 0.4},${h * 0.75} ${w * 0.8},${h * 0.25}`}
                  fill="none"
                  stroke={obj.color}
                  strokeWidth={obj.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {obj.type === 'symbol' && obj.symbolKind === 'cross' && (
                <g stroke={obj.color} strokeWidth={obj.strokeWidth} strokeLinecap="round">
                  <line x1={w * 0.2} y1={h * 0.2} x2={w * 0.8} y2={h * 0.8} />
                  <line x1={w * 0.8} y1={h * 0.2} x2={w * 0.2} y2={h * 0.8} />
                </g>
              )}

              {/* Highlight — semi-transparent filled rect */}
              {obj.type === 'highlight' && (
                <rect
                  width={w}
                  height={h}
                  fill={obj.color}
                  opacity={0.4}
                />
              )}

              {/* Pencil path — polyline theo points (relative to bbox top-left) */}
              {obj.type === 'path' && obj.points.length >= 2 && (
                <polyline
                  points={obj.points
                    .map((p) => `${(p.x - obj.x) * transform.scale},${(p.y - obj.y) * transform.scale}`)
                    .join(' ')}
                  fill="none"
                  stroke={obj.color}
                  strokeWidth={obj.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Text replacement — whiteout rect + text overlay */}
              {obj.type === 'text-replacement' && (
                <>
                  <rect
                    width={w}
                    height={h}
                    fill={obj.backgroundColor}
                  />
                  <foreignObject width={w} height={h}>
                    <div
                      className="h-full w-full overflow-hidden"
                      style={{
                        fontFamily: obj.fontFamily,
                        fontSize: obj.fontSize * transform.scale,
                        fontWeight: obj.fontWeight,
                        fontStyle: obj.fontStyle,
                        color: obj.color,
                        lineHeight: 1.2,
                        padding: '1px 2px',
                        boxSizing: 'border-box',
                      }}
                    >
                      {obj.content}
                    </div>
                  </foreignObject>
                </>
              )}

              {/* Selection handles */}
              {isSelected && (
                <rect
                  x={-2}
                  y={-2}
                  width={w + 4}
                  height={h + 4}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  className="pointer-events-none"
                />
              )}
            </g>
          );
        })}
    </svg>
  );
}
