// ============================================================
// Image Studio — Route
// ============================================================

import { useState } from 'react';
import { Image, Combine, Minimize2, FileText, ZoomIn, Stamp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { MergeImagesWorkspace } from './components/MergeImagesWorkspace';
import { CompressImagesWorkspace } from './components/CompressImagesWorkspace';
import { ImageToTextWorkspace } from './components/ImageToTextWorkspace';
import { EnhanceImageWorkspace } from './components/EnhanceImageWorkspace';
import { WatermarkImageWorkspace } from './components/WatermarkImageWorkspace';

type ImageOp = 'merge' | 'compress' | 'ocr' | 'enhance' | 'watermark' | null;

interface ToolCardProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}

function ToolCard({ icon, label, description, onClick }: ToolCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-5 text-center',
        'transition-all duration-150 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground leading-tight">{description}</span>
    </button>
  );
}

export default function ImageStudioRoute() {
  const [activeOp, setActiveOp] = useState<ImageOp>(null);

  if (activeOp === 'merge') {
    return (
      <Shell>
        <MergeImagesWorkspace onBack={() => setActiveOp(null)} />
      </Shell>
    );
  }

  if (activeOp === 'compress') {
    return (
      <Shell>
        <CompressImagesWorkspace onBack={() => setActiveOp(null)} />
      </Shell>
    );
  }

  if (activeOp === 'ocr') {
    return (
      <Shell>
        <ImageToTextWorkspace onBack={() => setActiveOp(null)} />
      </Shell>
    );
  }

  if (activeOp === 'enhance') {
    return (
      <Shell>
        <EnhanceImageWorkspace onBack={() => setActiveOp(null)} />
      </Shell>
    );
  }

  if (activeOp === 'watermark') {
    return (
      <Shell>
        <WatermarkImageWorkspace onBack={() => setActiveOp(null)} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <ToolCard
          icon={<Combine className="h-5 w-5" />}
          label="Gộp ảnh"
          description="Gộp nhiều ảnh thành 1 PDF"
          onClick={() => setActiveOp('merge')}
        />
        <ToolCard
          icon={<Minimize2 className="h-5 w-5" />}
          label="Nén ảnh"
          description="Giảm dung lượng ảnh"
          onClick={() => setActiveOp('compress')}
        />
        <ToolCard
          icon={<FileText className="h-5 w-5" />}
          label="Ảnh → Văn bản"
          description="Trích xuất text từ ảnh (OCR)"
          onClick={() => setActiveOp('ocr')}
        />
        <ToolCard
          icon={<ZoomIn className="h-5 w-5" />}
          label="Tăng độ phân giải"
          description="Upscale ảnh bằng AI"
          onClick={() => setActiveOp('enhance')}
        />
        <ToolCard
          icon={<Stamp className="h-5 w-5" />}
          label="Thêm Watermark"
          description="Đóng dấu text lên ảnh"
          onClick={() => setActiveOp('watermark')}
        />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Image className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Image Studio</h1>
        <p className="text-sm text-muted-foreground">Xử lý ảnh</p>
      </header>
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
