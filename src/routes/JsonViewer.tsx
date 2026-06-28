import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, Network, ListTree, PanelLeftOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraphView, type GraphViewRef } from '@/components/json-viewer/GraphView';
import { GraphToolbar } from '@/components/json-viewer/GraphToolbar';
import { TreeView } from '@/components/json-viewer/TreeView';
import { DataEditor } from '@/components/json-viewer/DataEditor';
import { NodeDetailsDialog } from '@/components/json-viewer/NodeDetailsDialog';
import { useJsonViewerStore } from '@/stores/jsonViewerStore';
import { useJsonViewerPrefsStore } from '@/stores/jsonViewerPrefsStore';
import { clearJsonViewerCaches } from '@/lib/json-viewer/cache-maintenance';
import type { LayoutDirection, NodeData, ViewMode } from '@/lib/json-viewer/types';
import { cn } from '@/lib/cn';
// ============================================================
// JSON / CSV Viewer route
// View tabs (Graph / Tree) đặt trong header để không ăn diện tích view.
// ============================================================

const DIRECTION_CYCLE: LayoutDirection[] = ['RIGHT', 'DOWN', 'LEFT', 'UP'];

const VIEW_TABS: { value: ViewMode; label: string; Icon: typeof Network }[] = [
  { value: 'graph', label: 'Graph', Icon: Network },
  { value: 'tree', label: 'Tree', Icon: ListTree },
];

export default function JsonViewer() {
  const rawData = useJsonViewerStore((s) => s.rawData);
  const filename = useJsonViewerStore((s) => s.sourceFilename);
  const format = useJsonViewerStore((s) => s.sourceFormat);
  const viewMode = useJsonViewerStore((s) => s.viewMode);
  const setViewMode = useJsonViewerStore((s) => s.setViewMode);
  const editorOpen = useJsonViewerStore((s) => s.editorOpen);
  const setEditorOpen = useJsonViewerStore((s) => s.setEditorOpen);
  const reset = useJsonViewerStore((s) => s.reset);

  const graphRef = useRef<GraphViewRef>(null);
  const [direction, setDirection] = useState<LayoutDirection>('RIGHT');
  const [collapsedCount, setCollapsedCount] = useState(0);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  const graphTheme = useJsonViewerPrefsStore((s) => s.graphTheme);
  const zoomOnScroll = useJsonViewerPrefsStore((s) => s.zoomOnScroll);
  const showRuler = useJsonViewerPrefsStore((s) => s.showRuler);

  const handleRotateDirection = useCallback(() => {
    setDirection((curr) => {
      const idx = DIRECTION_CYCLE.indexOf(curr);
      return DIRECTION_CYCLE[(idx + 1) % DIRECTION_CYCLE.length];
    });
  }, []);

  // Cleanup khi rời tool: terminate worker + clear node-size cache.
  // Worker singleton chiếm ~30MB RAM, cache Map có thể tích lũy nhiều
  // entries cho graph lớn. Free ra để hubibo nhẹ khi user dùng tool khác.
  useEffect(() => {
    return () => {
      clearJsonViewerCaches();
    };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Hub
            </Link>
          </Button>
          <h1 className="text-base font-semibold">JSON Viewer</h1>
          {!editorOpen && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {filename} <span className="ml-1 uppercase">({format})</span>
            </span>
          )}
        </div>

        {/* Phải header: View switcher + Reset */}
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="View mode"
            className="inline-flex h-9 items-center bg-muted p-1 text-muted-foreground"
          >
            {VIEW_TABS.map(({ value, label, Icon }) => {
              const active = viewMode === value;
              return (
                <button
                  key={value}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setViewMode(value)}
                  className={cn(
                    'inline-flex items-center gap-2 whitespace-nowrap px-3 py-1 text-sm font-medium transition-all',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    active ? 'bg-background text-foreground shadow' : 'hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="gap-1"
            title="Reset về sample"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </header>

      {/* Main: split editor | view */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {editorOpen ? (
          <section className="flex h-64 min-h-0 shrink-0 flex-col border-b border-border md:h-auto md:w-[420px] md:border-b-0 md:border-r">
            <DataEditor />
          </section>
        ) : (
          // Editor rail - click để mở lại editor. Cao toàn bộ trên desktop,
          // mảnh ngang ở trên cùng trên mobile.
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            title="Mở editor"
            className={cn(
              'group flex shrink-0 items-center justify-center border-border bg-card text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              // Mobile: thanh ngang trên cùng
              'h-8 w-full gap-2 border-b text-xs',
              // Desktop: thanh dọc cạnh trái
              'md:h-auto md:w-8 md:flex-col md:gap-2 md:border-b-0 md:border-r md:py-3'
            )}
          >
            <PanelLeftOpen className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            <span className="font-medium md:[writing-mode:vertical-rl] md:[transform:rotate(180deg)]">
              Editor
            </span>
          </button>
        )}

        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {viewMode === 'graph' && (
            <div className="relative h-full w-full">
              <GraphView
                ref={graphRef}
                json={rawData as object | string}
                theme={graphTheme}
                layoutDirection={direction}
                showControls={false}
                showGrid={showRuler}
                zoomOnScroll={zoomOnScroll}
                onCollapseChange={(paths) => setCollapsedCount(paths.length)}
                onNodeClick={(node) => setSelectedNode(node)}
              />
              <GraphToolbar
                graphRef={graphRef}
                direction={direction}
                onRotateDirection={handleRotateDirection}
                collapsedCount={collapsedCount}
              />
            </div>
          )}
          {viewMode === 'tree' && (
            <div className="h-full overflow-hidden bg-card">
              <TreeView data={rawData} />
            </div>
          )}
        </section>
      </div>

      <NodeDetailsDialog
        open={selectedNode !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedNode(null);
        }}
        nodeData={selectedNode}
      />
    </div>
  );
}