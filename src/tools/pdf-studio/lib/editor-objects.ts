// ============================================================
// PDF Studio Edit PDF — Object model (document coordinates)
// ============================================================
// All positions stored in document points with TOP-LEFT origin
// (x from left, y from top). This matches on-screen rendering 1:1
// after multiplying by scale. Export converts to PDF bottom-left.
// ============================================================

export type EditorObjectType = 'text' | 'image' | 'shape' | 'path' | 'symbol' | 'highlight' | 'text-replacement';

export interface BaseObject {
  id: string;
  type: EditorObjectType;
  pageId: string; // stable page identity
  x: number; // points from left edge of page
  y: number; // points from bottom edge of page
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number; // 0-100
  layerOrder: number;
  locked: boolean;
}

export interface TextObject extends BaseObject {
  type: 'text';
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface ImageObject extends BaseObject {
  type: 'image';
  assetId: string; // reference to binary asset in IndexedDB
  originalWidth: number;
  originalHeight: number;
}

export type ShapeKind = 'rectangle' | 'ellipse' | 'line' | 'arrow';

export interface ShapeObject extends BaseObject {
  type: 'shape';
  shapeKind: ShapeKind;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
}

export type SymbolKind = 'check' | 'cross';

export interface SymbolObject extends BaseObject {
  type: 'symbol';
  symbolKind: SymbolKind;
  color: string;
  strokeWidth: number;
}

export interface PathObject extends BaseObject {
  type: 'path' | 'highlight';
  points: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
}

export interface TextReplacementObject extends BaseObject {
  type: 'text-replacement';
  originalBounds: { x: number; y: number; width: number; height: number };
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  backgroundColor: string;
}

export type EditorObject =
  | TextObject
  | ImageObject
  | ShapeObject
  | SymbolObject
  | PathObject
  | TextReplacementObject;

// ─── Helpers ─────────────────────────────────────────────────

export function createId(): string {
  return crypto.randomUUID();
}

export function createTextObject(
  pageId: string,
  x: number,
  y: number,
  layerOrder: number,
): TextObject {
  return {
    id: createId(),
    type: 'text',
    pageId,
    x,
    y,
    width: 150,
    height: 24,
    rotation: 0,
    opacity: 100,
    layerOrder,
    locked: false,
    content: '',
    fontFamily: 'Helvetica',
    fontSize: 14,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#000000',
    align: 'left',
  };
}

export function createShapeObject(
  pageId: string,
  shapeKind: ShapeKind,
  x: number,
  y: number,
  width: number,
  height: number,
  layerOrder: number,
): ShapeObject {
  return {
    id: createId(),
    type: 'shape',
    pageId,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 100,
    layerOrder,
    locked: false,
    shapeKind,
    strokeColor: '#000000',
    fillColor: 'transparent',
    strokeWidth: 2,
  };
}

export function createSymbolObject(
  pageId: string,
  symbolKind: SymbolKind,
  x: number,
  y: number,
  layerOrder: number,
): SymbolObject {
  return {
    id: createId(),
    type: 'symbol',
    pageId,
    x,
    y,
    width: 20,
    height: 20,
    rotation: 0,
    opacity: 100,
    layerOrder,
    locked: false,
    symbolKind,
    color: '#000000',
    strokeWidth: 2,
  };
}

// ─── Coordinate transform helpers ───────────────────────────

export interface ViewportTransform {
  scale: number; // zoom factor (1 = 100%)
  offsetX: number; // canvas offset X in pixels
  offsetY: number; // canvas offset Y in pixels
  pageWidth: number; // page width in points
  pageHeight: number; // page height in points
}

// COORDINATE CONVENTION (unified):
// Object x, y, width, height are stored in document POINTS with TOP-LEFT origin
// (x from left edge, y from top edge). This matches screen rendering directly.
// Conversion to PDF bottom-left origin happens ONLY at export time.

/** Convert document point (top-left origin) to screen pixel offset from page stage top-left */
export function docToScreen(
  docX: number,
  docY: number,
  transform: ViewportTransform,
): { screenX: number; screenY: number } {
  return { screenX: docX * transform.scale, screenY: docY * transform.scale };
}

/** Convert screen pixel (offset from page stage top-left) to document point (top-left origin) */
export function screenToDoc(
  screenX: number,
  screenY: number,
  transform: ViewportTransform,
): { docX: number; docY: number } {
  return { docX: screenX / transform.scale, docY: screenY / transform.scale };
}

/** Scale a dimension from document points to screen pixels */
export function scaleToScreen(points: number, scale: number): number {
  return points * scale;
}
