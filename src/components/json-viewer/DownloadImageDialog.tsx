import { useState, type RefObject } from 'react';
import { Clipboard, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import type { GraphViewRef } from './GraphView';
import type { ExportImageFormat } from '@/lib/json-viewer/canvasHelpers';
import { cn } from '@/lib/cn';

// ============================================================
// DownloadImageDialog - port từ jsoncrack Download Image modal
// ============================================================
//
// Cho phép user chọn:
//   - File name (không cần extension, tự thêm)
//   - Format (PNG / JPEG / SVG)
//   - Background color (preset swatches + native color input + transparent)
//   - Hành động: Copy to Clipboard (PNG-only) hoặc Download
//
// Logic export đi qua `GraphView.exportImage` (ref API), call
// `exportGraphAsImage` trong `lib/json-viewer/canvasHelpers`.
// ============================================================

interface DownloadImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  graphRef: RefObject<GraphViewRef>;
  defaultFilename?: string;
}

const FORMATS: { value: ExportImageFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'svg', label: 'SVG' },
];

// Preset palette giống jsoncrack (mantine default color picker swatches).
const COLOR_SWATCHES = [
  '#B80000',
  '#DB3E00',
  '#FCCB00',
  '#008B02',
  '#006B76',
  '#1273DE',
  '#004DCF',
  '#5300EB',
  '#EB9694',
  '#FAD0C3',
  '#FEF3BD',
  '#C1E1C5',
  '#BEDADC',
  '#C4DEF6',
  '#BED3F3',
  '#D4C4FB',
  '#141414', // app dark bg default
  'transparent',
];

export function DownloadImageDialog({
  open,
  onOpenChange,
  graphRef,
  defaultFilename = 'graph',
}: DownloadImageDialogProps) {
  const [filename, setFilename] = useState(defaultFilename);
  const [format, setFormat] = useState<ExportImageFormat>('png');
  const [bg, setBg] = useState('#141414');
  const [busy, setBusy] = useState(false);

  const handleAction = async (target: 'download' | 'clipboard') => {
    const name = filename.trim() || defaultFilename;
    setBusy(true);
    try {
      await graphRef.current?.exportImage({
        filename: name,
        format,
        backgroundColor: bg,
        target,
      });
      if (target === 'clipboard') {
        toast.success('Đã copy vào clipboard');
      } else {
        toast.success(`Đã export ${format.toUpperCase()}`);
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export fail';
      toast.error(`Export lỗi: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  // Clipboard luôn enable: `exportGraphAsImage` internally đẩy PNG vào
  // ClipboardItem bất kể format download user chọn. Trải nghiệm jsoncrack
  // cũng cho phép clipboard ở mọi format.
  const clipboardEnabled = true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Download Image</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* File name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="export-filename">
              File Name
            </label>
            <Input
              id="export-filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="graph"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Format toggle (segmented) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Format</label>
            <div
              role="radiogroup"
              aria-label="Image format"
              className="inline-flex h-9 items-center border border-border bg-muted p-1 text-muted-foreground"
            >
              {FORMATS.map((f) => {
                const active = format === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setFormat(f.value)}
                    className={cn(
                      'flex-1 px-3 py-1 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      active ? 'bg-background text-foreground shadow' : 'hover:text-foreground'
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Background color */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-medium text-foreground"
              htmlFor="export-bg"
            >
              Background Color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="export-bg"
                type="color"
                value={bg === 'transparent' ? '#141414' : bg}
                onChange={(e) => setBg(e.target.value)}
                className="h-9 w-12 cursor-pointer border border-border bg-card p-0.5"
                aria-label="Pick custom color"
              />
              <Input
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                placeholder="#141414"
                autoComplete="off"
                spellCheck={false}
                className="flex-1"
              />
            </div>
            <div className="grid grid-cols-9 gap-1.5 pt-1">
              {COLOR_SWATCHES.map((color) => {
                const selected = bg.toLowerCase() === color.toLowerCase();
                const isTransparent = color === 'transparent';
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    onClick={() => setBg(color)}
                    title={color}
                    className={cn(
                      'relative h-6 w-6 border transition-transform',
                      selected
                        ? 'border-ring scale-110 ring-1 ring-ring'
                        : 'border-border hover:scale-110',
                      isTransparent && 'bg-[conic-gradient(at_50%_50%,#666_0_25%,#999_0_50%,#666_0_75%,#999_0)] bg-[length:8px_8px]'
                    )}
                    style={isTransparent ? undefined : { backgroundColor: color }}
                  />
                );
              })}
            </div>
          </div>

          {/* Divider + actions */}
          <div className="border-t border-border pt-3" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleAction('clipboard')}
              disabled={busy || !clipboardEnabled}
              title="Copy ảnh vào clipboard (PNG)"
              className="gap-2"
            >
              <Clipboard className="h-4 w-4" />
              Clipboard
            </Button>
            <Button
              type="button"
              onClick={() => handleAction('download')}
              disabled={busy}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}