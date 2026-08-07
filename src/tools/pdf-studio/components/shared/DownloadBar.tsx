// ============================================================
// PDF Studio Shared — Download bar (editable filename + download button)
// ============================================================
// Shows when a tool has result ready. Inline filename edit + download CTA.
// Designed to be placed inside WorkspaceHeader secondaryActions slot
// or as standalone bar.
// ============================================================

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DownloadBarProps {
  /** Default filename (without extension) */
  defaultName: string;
  /** File extension including dot, e.g. ".pdf" */
  extension: string;
  /** Blob to download */
  blob: Blob;
  /** Optional className */
  className?: string;
}

export function DownloadBar({ defaultName, extension, blob, className }: DownloadBarProps) {
  const [filename, setFilename] = useState(defaultName);

  const handleDownload = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <input
        type="text"
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
        className="h-8 w-40 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        title="Ten file output"
      />
      <span className="text-xs text-muted-foreground">{extension}</span>
      <Button size="sm" onClick={handleDownload} className="h-8 gap-1.5 px-3">
        <Download className="h-3.5 w-3.5" />
        Tai
      </Button>
    </div>
  );
}
