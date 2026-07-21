import { lazy, Suspense, useEffect } from 'react';
import { ArrowLeft, RotateCcw, PanelLeftOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataEditor } from '@/tools/json-studio/components/DataEditor';
import { TabBar } from '@/tools/json-studio/components/TabBar';
import { DataMetaBadge } from '@/tools/json-studio/components/DataMetaBadge';
import { VisualizeWorkspace } from '@/tools/json-studio/components/workspaces/VisualizeWorkspace';
import { ComingSoonWorkspace } from '@/tools/json-studio/components/workspaces/ComingSoonWorkspace';
import { LoadingState } from '@/components/shared';
import { useJsonStudioStore } from '@/tools/json-studio/store';
import { clearJsonStudioCaches } from '@/tools/json-studio/lib/cache-maintenance';
import { useActiveTab } from '@/tools/json-studio/lib/useActiveTab';
import { getTab } from '@/tools/json-studio/lib/tabs';
import { cn } from '@/lib/cn';

// Lazy 6 workspace feature — mỗi feature có deps riêng (ajv, jsonpath-plus),
// không nhồi vào main JsonStudio chunk. Fallback dùng LoadingState skeleton.
const FormatWorkspace = lazy(() =>
  import('@/tools/json-studio/components/workspaces/FormatWorkspace').then((m) => ({ default: m.FormatWorkspace }))
);
const DiffWorkspace = lazy(() =>
  import('@/tools/json-studio/components/workspaces/DiffWorkspace').then((m) => ({ default: m.DiffWorkspace }))
);
const ConvertWorkspace = lazy(() =>
  import('@/tools/json-studio/components/workspaces/ConvertWorkspace').then((m) => ({ default: m.ConvertWorkspace }))
);
const PathWorkspace = lazy(() =>
  import('@/tools/json-studio/components/workspaces/PathWorkspace').then((m) => ({ default: m.PathWorkspace }))
);
const SchemaWorkspace = lazy(() =>
  import('@/tools/json-studio/components/workspaces/SchemaWorkspace').then((m) => ({ default: m.SchemaWorkspace }))
);
const TsBridgeWorkspace = lazy(() =>
  import('@/tools/json-studio/components/workspaces/TsBridgeWorkspace').then((m) => ({ default: m.TsBridgeWorkspace }))
);

// ============================================================
// JSON Studio route — shell + workspace router
// ============================================================
//
// Header: back-to-hub + title + filename metadata + Reset
// TabBar: 7 feature tab (Phase 1: chỉ Visualize enabled, còn lại disabled)
// Body:  editor trái (chung cho mọi tab) + workspace phải theo activeTab
//
// URL:   /json-studio?tab=visualize (sync qua useActiveTab)
// Legacy /json-viewer → redirect trong App.tsx
// ============================================================

export default function JsonStudio() {
  const editorOpen = useJsonStudioStore((s) => s.editorOpen);
  const setEditorOpen = useJsonStudioStore((s) => s.setEditorOpen);
  const reset = useJsonStudioStore((s) => s.reset);

  const { activeTab, setActiveTab } = useActiveTab();
  const currentTab = getTab(activeTab);

  // Cleanup khi rời tool: terminate worker + clear node-size cache.
  // Worker singleton chiếm ~30MB RAM, cache Map có thể tích lũy nhiều
  // entries cho graph lớn. Free ra để hubibo nhẹ khi user dùng tool khác.
  useEffect(() => {
    return () => {
      clearJsonStudioCaches();
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
          <h1 className="text-base font-semibold">JSON Studio</h1>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Feature TabBar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Global data meta bar — chỉ hiện khi editor đóng, giữ context data cho mọi tab */}
      {!editorOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-1">
          <DataMetaBadge />
        </div>
      )}

      {/* Main: split editor | workspace */}
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
          <Suspense fallback={<LoadingState label={`Loading ${currentTab.label}...`} />}>
            {activeTab === 'visualize' && <VisualizeWorkspace />}
            {activeTab === 'format' && <FormatWorkspace />}
            {activeTab === 'diff' && <DiffWorkspace />}
            {activeTab === 'convert' && <ConvertWorkspace />}
            {activeTab === 'path' && <PathWorkspace />}
            {activeTab === 'schema' && <SchemaWorkspace />}
            {activeTab === 'ts' && <TsBridgeWorkspace />}
            {/* Fallback nếu tab disabled — hiện tại tất cả enabled, nhưng giữ */}
            {currentTab.disabled && <ComingSoonWorkspace tab={currentTab} />}
          </Suspense>
        </section>
      </div>
    </div>
  );
}