'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { JSONPath } from 'jsonc-parser';
import type { ViewPort } from 'react-zoomable-ui';
import { Space } from 'react-zoomable-ui';
import { Canvas } from 'reaflow';
import type { EdgeProps, ElkRoot, NodeProps } from 'reaflow';
import { useLongPress } from 'use-long-press';
import styles from '@/lib/json-viewer/JSONCrackStyles.module.css';
import {
  adjustViewPortZoom,
  buildCanvasClassName,
  buildCanvasStyle,
  buildEdgeTargetMap,
  exportGraphAsImage,
  fitGraphToViewPort,
  focusFirstSearchMatch,
  focusRootNode,
  getShiftWheelHorizontalPanDelta,
  highlightSearchMatches,
  markAnimating,
  parseJsonGraph,
  setCanvasDragging,
  setViewPortZoom,
  toJsonText,
  type ExportImageOptions,
  type JsonInput,
} from '@/lib/json-viewer/canvasHelpers';
import {
  CollapseContext,
  isNodeHidden,
  prunePaths,
} from '@/lib/json-viewer/CollapseContext';
import { Controls } from './Controls';
import { CustomEdge } from './CustomEdge';
import { CustomNode } from './CustomNode';
import type {
  CanvasThemeMode,
  GraphData,
  LayoutDirection,
  NodeData,
} from '@/lib/json-viewer/types';

// ============================================================
// GraphView - JSON Crack canvas wrapped vào hubibo
// Extract từ jsoncrack-react JSONCrackComponent.tsx. Apache 2.0 license.
// Giữ nguyên logic ELK + zoom + collapse (đã tune kỹ trong JSON Crack).
// ============================================================

const layoutOptions = {
  'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.spacing.edgeLabel': '15',
};

export interface GraphViewRef {
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (zoomFactor: number) => void;
  centerView: () => void;
  focusFirstNode: () => void;
  toggleCollapse: (path: JSONPath) => void;
  collapseAll: () => void;
  expandAll: () => void;
  getCollapsedPaths: () => string[];
  /** Export current graph thành image. Default PNG download. */
  exportImage: (options?: ExportImageOptions) => Promise<void>;
  /** Highlight nodes có text/key match query. Trả số match. */
  search: (query: string) => number;
  /** Pan camera tới node đầu tiên match search. */
  focusSearchMatch: () => boolean;
}

export interface GraphViewProps {
  json: JsonInput;
  theme?: CanvasThemeMode;
  layoutDirection?: LayoutDirection;
  showControls?: boolean;
  showGrid?: boolean;
  trackpadZoom?: boolean;
  centerOnLayout?: boolean;
  maxRenderableNodes?: number;
  /** Wheel = zoom (true, default). False thì wheel pan dọc, Shift+wheel pan ngang. */
  zoomOnScroll?: boolean;
  className?: string;
  style?: CSSProperties;
  onNodeClick?: (node: NodeData) => void;
  onParse?: (graph: GraphData) => void;
  onParseError?: (error: Error) => void;
  onViewportCreate?: (viewPort: ViewPort) => void;
  renderNodeLimitExceeded?: (nodeCount: number, maxRenderableNodes: number) => ReactNode;
  collapsedPaths?: string[];
  onToggleCollapse?: (path: JSONPath) => void;
  onCollapseChange?: (collapsedPaths: string[]) => void;
}

export const GraphView = forwardRef<GraphViewRef, GraphViewProps>(
  (
    {
      json,
      theme = 'dark',
      layoutDirection = 'RIGHT',
      showControls = true,
      showGrid = true,
      trackpadZoom = false,
      centerOnLayout = true,
      maxRenderableNodes = 1500,
      zoomOnScroll = true,
      className,
      style,
      onNodeClick,
      onParse,
      onParseError,
      onViewportCreate,
      renderNodeLimitExceeded,
      collapsedPaths: controlledCollapsedPaths,
      onToggleCollapse: controlledOnToggle,
      onCollapseChange,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [viewPort, setViewPort] = useState<ViewPort | null>(null);
    const [nodes, setNodes] = useState<GraphData['nodes']>([]);
    const [edges, setEdges] = useState<GraphData['edges']>([]);
    const [loading, setLoading] = useState(true);
    const [initialFitDone, setInitialFitDone] = useState(false);
    const [aboveSupportedLimit, setAboveSupportedLimit] = useState(false);
    const [totalNodes, setTotalNodes] = useState(0);
    const [paneWidth, setPaneWidth] = useState(2000);
    const [paneHeight, setPaneHeight] = useState(2000);
    const layoutSizeRef = useRef<{ width: number; height: number } | null>(null);

    const callbacksRef = useRef({ onParse, onParseError });
    const onViewportCreateRef = useRef(onViewportCreate);
    useEffect(() => {
      callbacksRef.current = { onParse, onParseError };
    }, [onParse, onParseError]);
    useEffect(() => {
      onViewportCreateRef.current = onViewportCreate;
    }, [onViewportCreate]);

    const baseCanvasClassName = useMemo(
      () => buildCanvasClassName(showGrid, className),
      [showGrid, className]
    );
    const canvasClassName = useMemo(
      () => (loading ? `${baseCanvasClassName} ${styles.processing}` : baseCanvasClassName),
      [baseCanvasClassName, loading]
    );
    const canvasStyle = useMemo(() => buildCanvasStyle(theme, style), [theme, style]);

    const jsonText = useMemo(() => toJsonText(json), [json]);

    useEffect(() => {
      setLoading(true);
      setInitialFitDone(false);
      const result = parseJsonGraph(jsonText, maxRenderableNodes);

      if (result.kind === 'error') {
        setNodes([]);
        setEdges([]);
        setLoading(false);
        callbacksRef.current.onParseError?.(result.error);
        return;
      }

      if (result.kind === 'above-limit') {
        setTotalNodes(result.total);
        setAboveSupportedLimit(true);
        setNodes([]);
        setEdges([]);
        setLoading(false);
        return;
      }

      const { graph, syntaxErrorCount } = result;
      if (syntaxErrorCount > 0) {
        callbacksRef.current.onParseError?.(
          new Error(`Failed to parse data (${syntaxErrorCount} syntax error(s)).`)
        );
      }
      setTotalNodes(graph.nodes.length);
      setAboveSupportedLimit(false);
      setNodes(graph.nodes);
      setEdges(graph.edges);
      callbacksRef.current.onParse?.({ nodes: graph.nodes, edges: graph.edges });
      if (graph.nodes.length === 0) setLoading(false);
    }, [jsonText, maxRenderableNodes]);

    useEffect(() => {
      if (!viewPort) return;
      const container = containerRef.current;
      if (!container || typeof ResizeObserver === 'undefined') return;

      const observer = new ResizeObserver(() => {
        if (container.clientWidth === 0 || container.clientHeight === 0) return;
        viewPort.updateContainerSize();
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, [viewPort]);

    useEffect(() => {
      if (!viewPort) return;
      const space = containerRef.current?.querySelector<HTMLElement>('.jsoncrack-space');
      if (!space) return;

      const handleShiftWheel = (event: WheelEvent) => {
        const delta = getShiftWheelHorizontalPanDelta(
          event,
          space.clientWidth || window.innerWidth
        );
        if (delta === null) return;

        const camera = viewPort.camera;
        if (!camera) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        camera.moveByInClientSpace(delta, 0, 0);
      };

      space.addEventListener('wheel', handleShiftWheel, { capture: true, passive: false });
      return () => space.removeEventListener('wheel', handleShiftWheel, { capture: true });
    }, [viewPort]);

    // Khi tắt zoom-on-scroll: wheel = pan dọc (Y), shift+wheel vẫn = pan ngang.
    // Capture trước react-zoomable-ui để chặn zoom default.
    useEffect(() => {
      if (zoomOnScroll) return; // Default behaviour của react-zoomable-ui là zoom
      if (!viewPort) return;
      const space = containerRef.current?.querySelector<HTMLElement>('.jsoncrack-space');
      if (!space) return;

      const handlePanWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.metaKey) return; // Ctrl/Cmd+wheel vẫn cho phép zoom
        if (event.shiftKey) return; // Để shift-wheel handler khác xử lý

        const camera = viewPort.camera;
        if (!camera) return;

        const rawDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
        if (rawDelta === 0) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        // Pan dọc với cùng sensitivity logic như shift+wheel pan ngang
        camera.moveByInClientSpace(0, rawDelta * 0.5, 0);
      };

      space.addEventListener('wheel', handlePanWheel, { capture: true, passive: false });
      return () => space.removeEventListener('wheel', handlePanWheel, { capture: true });
    }, [viewPort, zoomOnScroll]);

    const viewPortApi = useMemo(
      () => ({
        zoomIn: () => {
          markAnimating(containerRef.current);
          adjustViewPortZoom(viewPort, 0.1);
        },
        zoomOut: () => {
          markAnimating(containerRef.current);
          adjustViewPortZoom(viewPort, -0.1);
        },
        setZoom: (zoomFactor: number) => {
          markAnimating(containerRef.current);
          setViewPortZoom(viewPort, zoomFactor);
        },
        centerView: () => {
          markAnimating(containerRef.current, 500);
          fitGraphToViewPort(viewPort, containerRef.current, layoutSizeRef.current);
        },
        focusFirstNode: () => {
          markAnimating(containerRef.current, 500);
          focusRootNode(viewPort, containerRef.current);
        },
        exportImage: (options?: ExportImageOptions) =>
          exportGraphAsImage(containerRef.current, options),
        search: (query: string) => highlightSearchMatches(containerRef.current, query),
        focusSearchMatch: () => {
          markAnimating(containerRef.current, 500);
          return focusFirstSearchMatch(viewPort, containerRef.current);
        },
      }),
      [viewPort]
    );

    const [internalCollapsedPaths, setInternalCollapsedPaths] = useState<string[]>([]);
    const isControlled = controlledCollapsedPaths !== undefined;
    const collapsedPaths = isControlled ? controlledCollapsedPaths : internalCollapsedPaths;

    const onCollapseChangeRef = useRef(onCollapseChange);
    useEffect(() => {
      onCollapseChangeRef.current = onCollapseChange;
    }, [onCollapseChange]);

    useEffect(() => {
      if (isControlled) return;
      if (internalCollapsedPaths.length === 0) return;
      const kept = prunePaths(jsonText, internalCollapsedPaths);
      if (kept.length !== internalCollapsedPaths.length) setInternalCollapsedPaths(kept);
    }, [jsonText, internalCollapsedPaths, isControlled]);

    const collapsedSet = useMemo(() => new Set(collapsedPaths ?? []), [collapsedPaths]);

    const collapsedPrefixes = useMemo<JSONPath[]>(() => {
      if (collapsedSet.size === 0) return [];
      const out: JSONPath[] = [];
      for (const key of collapsedSet) {
        try {
          out.push(JSON.parse(key) as JSONPath);
        } catch {
          // skip malformed entries
        }
      }
      return out;
    }, [collapsedSet]);

    const { visibleNodes, visibleEdges } = useMemo(() => {
      if (collapsedPrefixes.length === 0) return { visibleNodes: nodes, visibleEdges: edges };
      const hiddenIds = new Set<string>();
      const keptNodes: typeof nodes = [];
      for (const node of nodes) {
        if (isNodeHidden(collapsedPrefixes, node.path)) {
          hiddenIds.add(node.id);
        } else {
          keptNodes.push(node);
        }
      }
      const keptEdges = edges.filter(
        (edge) => !hiddenIds.has(edge.from) && !hiddenIds.has(edge.to)
      );
      return { visibleNodes: keptNodes, visibleEdges: keptEdges };
    }, [nodes, edges, collapsedPrefixes]);

    const pendingRecenterRef = useRef<{
      key: string;
      clientX: number;
      clientY: number;
    } | null>(null);
    const [isRelayouting, setIsRelayouting] = useState(false);

    const findCollapseButton = useCallback((key: string): HTMLElement | null => {
      const container = containerRef.current;
      if (!container) return null;
      const buttons = container.querySelectorAll<HTMLElement>('[data-collapse-path]');
      for (let i = 0; i < buttons.length; i += 1) {
        if (buttons[i].getAttribute('data-collapse-path') === key) return buttons[i];
      }
      return null;
    }, []);

    const wrappedToggleCollapse = useCallback(
      (path: JSONPath) => {
        const key = JSON.stringify(path);
        const btn = findCollapseButton(key);
        if (btn) {
          const rect = btn.getBoundingClientRect();
          pendingRecenterRef.current = {
            key,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          };
          setIsRelayouting(true);
        } else {
          pendingRecenterRef.current = null;
        }
        if (isControlled) {
          controlledOnToggle?.(path);
          return;
        }
        setInternalCollapsedPaths((prev) => {
          const next = prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key];
          onCollapseChangeRef.current?.(next);
          return next;
        });
      },
      [isControlled, controlledOnToggle, findCollapseButton]
    );

    const collapseContextValue = useMemo(
      () => ({ collapsedSet, onToggleCollapse: wrappedToggleCollapse }),
      [collapsedSet, wrappedToggleCollapse]
    );

    const collapsedPathsRef = useRef(collapsedPaths);
    collapsedPathsRef.current = collapsedPaths;

    const collapseApi = useMemo(
      () => ({
        toggleCollapse: (path: JSONPath) => wrappedToggleCollapse(path),
        collapseAll: () => {
          if (isControlled) return;
          let parsed: unknown;
          try {
            parsed = JSON.parse(jsonText);
          } catch {
            return;
          }
          if (!parsed || typeof parsed !== 'object') return;
          const keys = Array.isArray(parsed)
            ? parsed.map((_, i) => i)
            : Object.keys(parsed as Record<string, unknown>);
          const next: string[] = [];
          for (const k of keys) {
            const v = (parsed as Record<string | number, unknown>)[k as string & number];
            if (v && typeof v === 'object') {
              if (Array.isArray(v) && v.length === 0) continue;
              if (!Array.isArray(v) && Object.keys(v).length === 0) continue;
              next.push(JSON.stringify([k]));
            }
          }
          setInternalCollapsedPaths(next);
          onCollapseChangeRef.current?.(next);
        },
        expandAll: () => {
          if (isControlled) return;
          setInternalCollapsedPaths([]);
          onCollapseChangeRef.current?.([]);
        },
        getCollapsedPaths: () => collapsedPathsRef.current ?? [],
      }),
      [isControlled, jsonText, wrappedToggleCollapse]
    );

    useImperativeHandle(ref, () => ({ ...viewPortApi, ...collapseApi }), [
      viewPortApi,
      collapseApi,
    ]);

    const edgeTargetById = useMemo(() => buildEdgeTargetMap(visibleEdges), [visibleEdges]);

    const visibleNodesRef = useRef(visibleNodes);
    visibleNodesRef.current = visibleNodes;
    const isFirstCollapsedPassRef = useRef(true);
    useEffect(() => {
      if (isFirstCollapsedPassRef.current) {
        isFirstCollapsedPassRef.current = false;
        return;
      }
      if (visibleNodesRef.current.length > 0) setLoading(true);
    }, [collapsedSet]);

    const onLayoutChange = useCallback((layout: ElkRoot) => {
      if (!layout.width || !layout.height) {
        setLoading(false);
        return;
      }

      layoutSizeRef.current = { width: layout.width, height: layout.height };
      setPaneWidth(layout.width + 50);
      setPaneHeight(layout.height + 50);
      setLoading(false);
    }, []);

    useEffect(() => {
      const pending = pendingRecenterRef.current;
      if (!pending) return;
      pendingRecenterRef.current = null;

      let cancelled = false;
      let attempts = 0;
      let lastX: number | null = null;
      let lastY: number | null = null;
      let movementSeen = false;
      const MAX_ATTEMPTS = 180;

      const finish = (x?: number, y?: number) => {
        if (x !== undefined && y !== undefined) {
          const dx = x - pending.clientX;
          const dy = y - pending.clientY;
          if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
            viewPort?.camera?.moveByInClientSpace(dx, dy);
          }
        }
        setIsRelayouting(false);
      };

      const tick = () => {
        if (cancelled) return;
        attempts += 1;
        const btn = findCollapseButton(pending.key);
        if (!btn) {
          if (attempts < MAX_ATTEMPTS) requestAnimationFrame(tick);
          else finish();
          return;
        }
        const rect = btn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        if (lastX !== null) {
          const moved = Math.abs(x - lastX) >= 0.5 || Math.abs(y - (lastY ?? 0)) >= 0.5;
          if (moved) {
            movementSeen = true;
          } else if (movementSeen) {
            finish(x, y);
            return;
          }
        }

        lastX = x;
        lastY = y;

        if (attempts < MAX_ATTEMPTS) {
          requestAnimationFrame(tick);
        } else if (movementSeen) {
          finish(x, y);
        } else {
          finish();
        }
      };

      const rafId = requestAnimationFrame(tick);
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
        setIsRelayouting(false);
      };
    }, [visibleNodes, visibleEdges, viewPort, findCollapseButton]);

    useEffect(() => {
      if (initialFitDone) return;
      if (!centerOnLayout) {
        setInitialFitDone(true);
        return;
      }
      if (!viewPort || visibleNodes.length === 0 || loading) return;
      if (!layoutSizeRef.current) return;

      let cancelled = false;
      const rafId = window.requestAnimationFrame(() => {
        if (cancelled) return;
        fitGraphToViewPort(viewPort, containerRef.current, layoutSizeRef.current);
        setInitialFitDone(true);
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(rafId);
      };
    }, [viewPort, visibleNodes, loading, centerOnLayout, initialFitDone, paneWidth, paneHeight]);

    const renderNode = useCallback(
      (nodeProps: NodeProps) => <CustomNode {...nodeProps} onNodeClick={onNodeClick} />,
      [onNodeClick]
    );
    const renderEdge = useCallback(
      (edgeProps: EdgeProps) => (
        <CustomEdge
          {...edgeProps}
          viewPort={viewPort}
          edgeTargetById={edgeTargetById}
          hostElement={containerRef.current}
        />
      ),
      [viewPort, edgeTargetById]
    );

    const bindLongPress = useLongPress(() => setCanvasDragging(containerRef.current, true), {
      threshold: 150,
      onFinish: () => setCanvasDragging(containerRef.current, false),
    });

    const tooLargeContent = renderNodeLimitExceeded?.(totalNodes, maxRenderableNodes);

    return (
      <div
        ref={containerRef}
        className={canvasClassName}
        style={canvasStyle}
        role="img"
        aria-label="JSON data visualization"
        onContextMenu={(event) => event.preventDefault()}
        {...bindLongPress()}
      >
        {showControls && (
          <Controls
            onFocusRoot={viewPortApi.focusFirstNode}
            onCenterView={viewPortApi.centerView}
            onZoomOut={viewPortApi.zoomOut}
            onZoomIn={viewPortApi.zoomIn}
          />
        )}

        {aboveSupportedLimit &&
          (tooLargeContent ? (
            tooLargeContent
          ) : (
            <div className={styles.tooLarge}>
              {`Graph có ${totalNodes} nodes, vượt giới hạn ${maxRenderableNodes}.`}
            </div>
          ))}

        {/* Loading: KHÔNG spinner overlay nữa (giật + cạnh tranh CPU với ELK).
            Thay vào đó toggle class .processing trên container → blur graph nhẹ
            qua CSS GPU compositing → mượt 60fps không phụ thuộc main thread. */}
        {loading && <div className={styles.overlay} aria-label="Đang xử lý" />}

        <Space
          onCreate={(nextViewPort) => {
            setViewPort(nextViewPort);
            onViewportCreateRef.current?.(nextViewPort);
          }}
          onContextMenu={(event) => event.preventDefault()}
          treatTwoFingerTrackPadGesturesLikeTouch={trackpadZoom}
          className="jsoncrack-space"
          style={{
            opacity: initialFitDone && !isRelayouting ? 1 : 0,
            visibility: isRelayouting ? 'hidden' : 'visible',
            transition: 'opacity 120ms',
          }}
        >
          <CollapseContext.Provider value={collapseContextValue}>
            <Canvas
              className="jsoncrack-canvas"
              onLayoutChange={onLayoutChange}
              node={renderNode}
              edge={renderEdge}
              nodes={visibleNodes}
              edges={visibleEdges}
              arrow={null}
              maxHeight={paneHeight}
              maxWidth={paneWidth}
              height={paneHeight}
              width={paneWidth}
              direction={layoutDirection}
              layoutOptions={layoutOptions}
              key={layoutDirection}
              pannable={false}
              zoomable={false}
              animated={false}
              readonly
              dragEdge={null}
              dragNode={null}
              defaultPosition={null as unknown as undefined}
            />
          </CollapseContext.Provider>
        </Space>
      </div>
    );
  }
);

GraphView.displayName = 'GraphView';