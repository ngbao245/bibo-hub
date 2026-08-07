// ============================================================
// PDF Studio — Route (flat ToolGrid, no tab nav)
// ============================================================

import { FileOutput, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HistoryPanel } from './components/HistoryPanel';
import { ToolGrid } from './components/ToolGrid';
import { ConvertWorkspace } from './components/ConvertWorkspace';
import { MergeWorkspace } from './components/MergeWorkspace';
import { CompressWorkspace } from './components/CompressWorkspace';
import { UnlockWorkspace } from './components/UnlockWorkspace';
import { LockPdfWorkspace } from './components/LockPdfWorkspace';
import { AddPageNumbersWorkspace } from './components/AddPageNumbersWorkspace';
import { SplitWorkspace } from './components/SplitWorkspace';
import { RemovePagesWorkspace } from './components/RemovePagesWorkspace';
import { CropWorkspace } from './components/CropWorkspace';
import { WatermarkPdfWorkspace } from './components/WatermarkPdfWorkspace';
import { RotatePagesWorkspace } from './components/RotatePagesWorkspace';
import { PdfToImagesWorkspace } from './components/PdfToImagesWorkspace';
import { EditPdfWorkspace } from './components/editor/EditPdfWorkspace';
import { usePdfStudioStore } from './store';

export default function PdfStudioRoute() {
  const {
    view,
    activeToolOp,
    setView,
    setActiveToolOp,
    setBatchId,
  } = usePdfStudioStore();

  if (view === 'history') {
    return (
      <HistoryPanel
        onBack={() => setView('toolbox')}
        onOpenBatch={(batchId) => {
          setBatchId(batchId);
          setActiveToolOp('convert');
          setView('toolbox');
        }}
      />
    );
  }

  // Edit PDF workspace takes over entire viewport
  if (activeToolOp === 'edit') {
    return <EditPdfWorkspace onBack={() => setActiveToolOp(null)} />;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <FileOutput className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">PDF Studio</h1>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setView('history')}>
            <RotateCcw className="h-3.5 w-3.5" />
            Lich su
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-6">
        {!activeToolOp && <ToolGrid onSelectOp={setActiveToolOp} />}
        {activeToolOp === 'convert' && <ConvertWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'merge' && <MergeWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'compress' && <CompressWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'unlock' && <UnlockWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'lock' && <LockPdfWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'page_numbers' && <AddPageNumbersWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'split' && <SplitWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'remove_pages' && <RemovePagesWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'crop' && <CropWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'watermark' && <WatermarkPdfWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'rotate' && <RotatePagesWorkspace onBack={() => setActiveToolOp(null)} />}
        {activeToolOp === 'to_images' && <PdfToImagesWorkspace onBack={() => setActiveToolOp(null)} />}
      </main>
    </div>
  );
}
