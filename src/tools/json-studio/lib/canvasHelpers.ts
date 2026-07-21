import type { CSSProperties } from 'react';
import type { ViewPort } from 'react-zoomable-ui';
import { toBlob, toJpeg, toPng, toSvg } from 'html-to-image';
import styles from './JSONCrackStyles.module.css';
import { parseGraph } from './parser';
import { themes } from './theme';
import type { CanvasThemeMode, GraphData } from './types';

// ============================================================
// Canvas helpers - extract từ jsoncrack-react canvasHelpers.ts
// Apache 2.0 license. Logic geometry/zoom giữ nguyên (đã được tune kỹ).
// ============================================================

export type JsonInput = string | object;

const objectJsonCache = new WeakMap<object, string>();

/** Normalize the `json` prop to a string, memoizing per object instance to avoid re-stringifying unchanged references. */
export const toJsonText = (json: JsonInput): string => {
  if (typeof json === 'string') return json;

  if (json && typeof json === 'object') {
    const cached = objectJsonCache.get(json);
    if (cached) return cached;

    const serialized = JSON.stringify(json, null, 2);
    objectJsonCache.set(json, serialized);
    return serialized;
  }

  return JSON.stringify(json, null, 2);
};

export const buildCanvasClassName = (showGrid: boolean, userClassName?: string): string =>
  [styles.canvasWrapper, showGrid ? styles.showGrid : '', userClassName].filter(Boolean).join(' ');

export const buildCanvasStyle = (
  theme: CanvasThemeMode,
  userStyle?: CSSProperties
): CSSProperties => {
  const themeTokens = themes[theme];
  const isDark = theme === 'dark';

  return {
    '--bg-color': themeTokens.GRID_BG_COLOR,
    '--line-color-1': themeTokens.GRID_COLOR_PRIMARY,
    '--line-color-2': themeTokens.GRID_COLOR_SECONDARY,
    '--edge-stroke': isDark ? '#444444' : '#BCBEC0',
    '--node-fill': isDark ? '#292929' : '#ffffff',
    '--node-stroke': isDark ? '#424242' : '#BCBEC0',
    '--node-shadow': isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(15, 23, 42, 0.25)',
    '--interactive-normal': themeTokens.INTERACTIVE_NORMAL,
    '--background-node': themeTokens.BACKGROUND_NODE,
    '--node-text': themeTokens.NODE_COLORS.TEXT,
    '--node-key': themeTokens.NODE_COLORS.NODE_KEY,
    '--node-value': themeTokens.NODE_COLORS.NODE_VALUE,
    '--node-integer': themeTokens.NODE_COLORS.INTEGER,
    '--node-null': themeTokens.NODE_COLORS.NULL,
    '--node-bool-true': themeTokens.NODE_COLORS.BOOL.TRUE,
    '--node-bool-false': themeTokens.NODE_COLORS.BOOL.FALSE,
    '--node-child-count': themeTokens.NODE_COLORS.CHILD_COUNT,
    '--node-divider': themeTokens.NODE_COLORS.DIVIDER,
    '--text-positive': themeTokens.TEXT_POSITIVE,
    '--background-modifier-accent': themeTokens.BACKGROUND_MODIFIER_ACCENT,
    '--spinner-track': isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(17, 24, 39, 0.2)',
    '--spinner-head': isDark ? '#FFFFFF' : '#111827',
    '--overlay-bg': isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.38)',
    ...userStyle,
  } as CSSProperties;
};

export type ParseJsonGraphResult =
  | { kind: 'ok'; graph: GraphData; syntaxErrorCount: number }
  | { kind: 'above-limit'; total: number }
  | { kind: 'error'; error: Error };

export const parseJsonGraph = (
  jsonText: string,
  maxRenderableNodes: number
): ParseJsonGraphResult => {
  try {
    const graph = parseGraph(jsonText);
    if (graph.nodes.length > maxRenderableNodes) {
      return { kind: 'above-limit', total: graph.nodes.length };
    }
    return { kind: 'ok', graph, syntaxErrorCount: graph.errors.length };
  } catch (error) {
    return {
      kind: 'error',
      error: error instanceof Error ? error : new Error('Unable to parse data.'),
    };
  }
};

export const buildEdgeTargetMap = (edges: GraphData['edges']): Map<string, string> => {
  const targetById = new Map<string, string>();
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i];
    targetById.set(edge.id, edge.to);
  }
  return targetById;
};

export const setCanvasDragging = (container: HTMLElement | null, dragging: boolean): void => {
  const canvas = container?.querySelector('.jsoncrack-canvas') as HTMLElement | null;
  if (!canvas) return;
  canvas.classList.toggle('dragging', dragging);
};

/** Toggle `.animating` class trên wrapper. Auto-clear sau `durationMs` (default 400ms). */
const animatingTimerWeakMap = new WeakMap<HTMLElement, number>();
export const markAnimating = (container: HTMLElement | null, durationMs = 400): void => {
  if (!container) return;
  container.classList.add('animating');
  const existing = animatingTimerWeakMap.get(container);
  if (existing) window.clearTimeout(existing);
  const timer = window.setTimeout(() => {
    container.classList.remove('animating');
    animatingTimerWeakMap.delete(container);
  }, durationMs);
  animatingTimerWeakMap.set(container, timer);
};

const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const LINE_WHEEL_DELTA_SCALE = 7.15625;
const HORIZONTAL_WHEEL_PAN_SENSITIVITY = 0.5;

export const getShiftWheelHorizontalPanDelta = (
  event: Pick<WheelEvent, 'shiftKey' | 'deltaX' | 'deltaY' | 'deltaMode'>,
  pageDeltaScale: number
): number | null => {
  if (!event.shiftKey) return null;

  const rawDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
  if (rawDelta === 0) return null;

  let scale = 1;
  if (event.deltaMode === DOM_DELTA_LINE) scale = LINE_WHEEL_DELTA_SCALE;
  if (event.deltaMode === DOM_DELTA_PAGE) scale = pageDeltaScale;

  return rawDelta * scale * HORIZONTAL_WHEEL_PAN_SENSITIVITY;
};

const GRAPH_FIT_PADDING_RATIO = 0.02;

const unionContentGroupLeafRects = (
  contentGroup: SVGGElement
): { left: number; top: number; width: number; height: number } | null => {
  const leaves = contentGroup.querySelectorAll('g[id]');
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let found = false;

  for (let i = 0; i < leaves.length; i += 1) {
    const rect = leaves[i].getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.left < left) left = rect.left;
    if (rect.top < top) top = rect.top;
    if (rect.right > right) right = rect.right;
    if (rect.bottom > bottom) bottom = rect.bottom;
    found = true;
  }

  if (!found) return null;
  return { left, top, width: right - left, height: bottom - top };
};

const projectRectThroughMatrix = (
  svg: SVGSVGElement,
  matrix: DOMMatrix,
  x: number,
  y: number,
  width: number,
  height: number
): { left: number; top: number; width: number; height: number } => {
  const origin = svg.createSVGPoint();
  origin.x = x;
  origin.y = y;
  const corner = svg.createSVGPoint();
  corner.x = x + width;
  corner.y = y + height;
  const a = origin.matrixTransform(matrix);
  const b = corner.matrixTransform(matrix);
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
};

export const computeGraphClientRect = (
  container: HTMLElement | null,
  layoutSize: { width: number; height: number } | null
): DOMRect | null => {
  if (!container) return null;

  const svg = container.querySelector('.jsoncrack-canvas svg') as SVGSVGElement | null;
  if (!svg) return null;

  let raw: { left: number; top: number; width: number; height: number } | null = null;
  const contentGroup = svg.querySelector(':scope > g') as SVGGElement | null;

  if (contentGroup) {
    raw = unionContentGroupLeafRects(contentGroup);
  }

  if (!raw && contentGroup) {
    const rect = contentGroup.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      raw = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
  }

  if (!raw && contentGroup && typeof contentGroup.getScreenCTM === 'function') {
    try {
      const bbox = contentGroup.getBBox();
      const ctm = contentGroup.getScreenCTM();
      if (ctm && bbox.width > 0 && bbox.height > 0) {
        raw = projectRectThroughMatrix(svg, ctm, bbox.x, bbox.y, bbox.width, bbox.height);
      }
    } catch {
      // ignore detached/hidden errors
    }
  }

  if (
    !raw &&
    layoutSize &&
    layoutSize.width > 0 &&
    layoutSize.height > 0 &&
    typeof svg.getScreenCTM === 'function'
  ) {
    const ctm = svg.getScreenCTM();
    if (ctm) {
      raw = projectRectThroughMatrix(svg, ctm, 0, 0, layoutSize.width, layoutSize.height);
    }
  }

  if (!raw || raw.width <= 0 || raw.height <= 0) return null;

  const padX = raw.width * GRAPH_FIT_PADDING_RATIO;
  const padY = raw.height * GRAPH_FIT_PADDING_RATIO;
  return DOMRect.fromRect({
    x: raw.left - padX,
    y: raw.top - padY,
    width: raw.width + padX * 2,
    height: raw.height + padY * 2,
  });
};

export const fitGraphToViewPort = (
  viewPort: ViewPort | null,
  container: HTMLElement | null,
  layoutSize: { width: number; height: number } | null
): void => {
  if (!viewPort || !container) return;

  viewPort.updateContainerSize();

  const rect = computeGraphClientRect(container, layoutSize);
  if (!rect) return;

  const virtualRect = viewPort.translateClientRectToVirtualSpace(rect);
  viewPort.camera?.centerFitAreaIntoView(virtualRect);
};

export const focusRootNode = (viewPort: ViewPort | null, container: HTMLElement | null): void => {
  if (!viewPort || !container) return;
  const rootNode = container.querySelector("g[id$='node-1']") as HTMLElement | null;
  if (!rootNode) return;
  viewPort.camera?.centerFitElementIntoView(rootNode, {
    elementExtraMarginForZoom: 100,
  });
};

export const setViewPortZoom = (viewPort: ViewPort | null, zoomFactor: number): void => {
  if (!viewPort) return;
  viewPort.camera?.recenter(viewPort.centerX, viewPort.centerY, zoomFactor);
};

export const adjustViewPortZoom = (viewPort: ViewPort | null, delta: number): void => {
  if (!viewPort) return;
  viewPort.camera?.recenter(viewPort.centerX, viewPort.centerY, viewPort.zoomFactor + delta);
};


// ============================================================
// Export SVG canvas → image (PNG/JPEG/SVG) download hoặc clipboard
// ============================================================
//
// Dùng `html-to-image` để snapshot. Lý do:
//  - Cách self-roll (clone SVG + drawImage canvas) fail với foreignObject
//    chứa HTML span (cách Reaflow render text trong node) → output trống chữ.
//  - `html-to-image` xử lý foreignObject, inline CSS, embed fonts đúng cách.
//    JsonCrack cũng dùng cùng lib này (pin 1.11.11).
//  - Target export là element `.jsoncrack-canvas` (wrapper Reaflow), không
//    phải SVG con bên trong → preserve mọi style.
// ============================================================

export type ExportImageFormat = 'png' | 'jpeg' | 'svg';
export type ExportImageTarget = 'download' | 'clipboard';

export interface ExportImageOptions {
  /** Tên file (không bao gồm extension). */
  filename?: string;
  /** Định dạng output. */
  format?: ExportImageFormat;
  /** Background color: CSS color string hoặc 'transparent'. */
  backgroundColor?: string;
  /** 'download' = lưu file, 'clipboard' = copy ảnh vào clipboard. */
  target?: ExportImageTarget;
  /** Quality cho JPEG (0-1). Default 1. */
  quality?: number;
}

const FORMAT_TO_TO_IMAGE = {
  png: toPng,
  jpeg: toJpeg,
  svg: toSvg,
} as const;

const EXTENSION = {
  png: 'png',
  jpeg: 'jpg',
  svg: 'svg',
} as const;

function findExportElement(container: HTMLElement): HTMLElement | null {
  // Ưu tiên `.jsoncrack-canvas` wrapper (Reaflow Canvas component) — chứa SVG
  // + foreignObject HTML đầy đủ. Fallback về svg trực tiếp nếu wrapper biến mất
  // (vd lib upgrade khiến class đổi).
  const canvas = container.querySelector<HTMLElement>('.jsoncrack-canvas');
  if (canvas) return canvas;
  const svg = container.querySelector<HTMLElement>('.jsoncrack-canvas svg, svg');
  return svg;
}

/**
 * Snapshot graph thành image. Hỗ trợ PNG / JPEG / SVG, download hoặc clipboard.
 * Clipboard chỉ hoạt động với PNG (ClipboardItem MIME limitation).
 */
export const exportGraphAsImage = async (
  container: HTMLElement | null,
  options: ExportImageOptions = {}
): Promise<void> => {
  const {
    filename = 'graph',
    format = 'png',
    backgroundColor = '#141414',
    target = 'download',
    quality = 1,
  } = options;

  if (!container) throw new Error('Container không sẵn sàng.');
  const element = findExportElement(container);
  if (!element) throw new Error('Không tìm thấy canvas để export.');

  // Options chung cho html-to-image. `skipFonts: true` quan trọng để không
  // try-fetch CSS @font-face từ Google Fonts (CORS fail). Render bằng font đã
  // load sẵn trong document.
  const imageOptions = {
    quality,
    backgroundColor: backgroundColor === 'transparent' ? undefined : backgroundColor,
    skipFonts: true,
    cacheBust: true,
    // Pixel ratio mặc định của lib lấy theo `window.devicePixelRatio`. Bump
    // tối thiểu 2 cho hi-DPI output (rõ trên Retina).
    pixelRatio: Math.max(window.devicePixelRatio || 1, 2),
  };

  // --- Clipboard path ---
  if (target === 'clipboard') {
    // Clipboard cần Blob, không phải data URI. Format ép về PNG vì
    // ClipboardItem chỉ hỗ trợ image/png ở major browsers.
    const blob = await toBlob(element, imageOptions);
    if (!blob) throw new Error('Không snapshot được canvas.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Item = (window as any).ClipboardItem;
    if (!Item || !navigator.clipboard?.write) {
      throw new Error('Browser không hỗ trợ copy ảnh vào clipboard.');
    }
    await navigator.clipboard.write([new Item({ 'image/png': blob })]);
    return;
  }

  // --- Download path ---
  const toImage = FORMAT_TO_TO_IMAGE[format];
  const dataUri = await toImage(element, imageOptions);
  triggerDownload(dataUri, `${filename}.${EXTENSION[format]}`);
};

function triggerDownload(dataUri: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** @deprecated Dùng `exportGraphAsImage` với options thay cho hàm này. */
export const exportGraphAsPng = (
  container: HTMLElement | null,
  filename = 'graph.png'
): Promise<void> => {
  const cleanName = filename.replace(/\.png$/i, '');
  return exportGraphAsImage(container, {
    filename: cleanName,
    format: 'png',
    target: 'download',
  });
};

// ============================================================
// Highlight matching nodes by search query
// ============================================================

/** Apply/remove .searched class lên foreignObject của các node có text match query. Trả số match. */
export const highlightSearchMatches = (container: HTMLElement | null, query: string): number => {
  if (!container) return 0;
  const trimmed = query.trim().toLowerCase();
  const rows = container.querySelectorAll<HTMLElement>('[data-key]');
  let count = 0;
  rows.forEach((row) => {
    row.classList.remove('searched');
    if (!trimmed) return;
    const key = (row.getAttribute('data-key') || '').toLowerCase();
    if (key.includes(trimmed)) {
      row.classList.add('searched');
      count += 1;
    }
  });
  return count;
};

/** Pan camera tới node đầu tiên match query. */
export const focusFirstSearchMatch = (
  viewPort: ViewPort | null,
  container: HTMLElement | null
): boolean => {
  if (!viewPort || !container) return false;
  const match = container.querySelector<HTMLElement>('.searched');
  if (!match) return false;
  // Tìm group cha (g[data-id]) để center
  let node: HTMLElement | null = match;
  while (node && !node.getAttribute('data-id')?.startsWith('node-')) {
    node = node.parentElement;
  }
  const target = node?.parentElement;
  if (target) {
    viewPort.camera?.centerFitElementIntoView(target, { elementExtraMarginForZoom: 150 });
    return true;
  }
  return false;
};