import { useCallback, useRef, useState } from 'react';
import { Network, ListTree } from 'lucide-react';
import { GraphView, type GraphViewRef } from '../GraphView';
import { GraphToolbar } from '../GraphToolbar';
import { TreeView } from '../TreeView';
import { NodeDetailsDialog } from '../NodeDetailsDialog';
import { useJsonStudioStore } from '@/tools/json-studio/store';
import { useJsonStudioPrefsStore } from '@/tools/json-studio/prefs-store';
import type { LayoutDirection, NodeData, ViewMode } from '@/tools/json-studio/lib/types';
import { cn } from '@/lib/cn';

// ============================================================
// VisualizeWorkspace — feature Visualize (migrate từ json-viewer cũ)
// ============================================================
//
// Sub-tab Graph|Tree nằm TRONG workspace (không phải header tool).
// Rationale: top tab bar đã là feature switcher, không nhồi thêm view-mode
// tabs cùng cấp — user sẽ nhầm giữa "chuyển feature" và "chuyển view".
// ============================================================

const DIRECTION_CYCLE: LayoutDirection[] = ['RIGHT', 'DOWN', 'LEFT', 'UP'];

const VIEW_TABS: { value: ViewMode; label: string; Icon: typeof Network }[] = [
  { value: 'graph', label: 'Graph', Icon: Network },
  { value: 'tree', label: 'Tree', Icon: ListTree },
];

export function VisualizeWorkspace() {
  const rawData = useJsonStudioStore((s) => s.rawData);
  const viewMode = useJsonStudioStore((s) => s.viewMode);
  const setViewMode = useJsonStudioStore((s) => s.setViewMode);

  const graphRef = useRef<GraphViewRef>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const [direction, setDirection] = useState<LayoutDirection>('RIGHT');
  const [collapsedCount, setCollapsedCount] = useState(0);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  const graphTheme = useJsonStudioPrefsStore((s) => s.graphTheme);
  const zoomOnScroll = useJsonStudioPrefsStore((s) => s.zoomOnScroll);
  const showRuler = useJsonStudioPrefsStore((s) => s.showRuler);

  const handleRotateDirection = useCallback(() => {
    setDirection((curr) => {
      const idx = DIRECTION_CYCLE.indexOf(curr);
      return DIRECTION_CYCLE[(idx + 1) % DIRECTION_CYCLE.length];
    });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sub-tab bar Graph | Tree */}
      <div className="flex items-center gap-2 border-b border-border bg-card/50 px-3 py-1.5">
        <div
          role="tablist"
          aria-label="View mode"
          className="inline-flex h-8 items-center bg-muted p-0.5 text-muted-foreground"
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
                  'inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  active ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* View canvas */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {viewMode === 'graph' && (
          <div
            ref={graphContainerRef}
            className="relative h-full w-full bg-background"
          >
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
              fullscreenTarget={graphContainerRef}
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