import { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { downloadBlob } from '@/tools/project-packer/lib/unpack';
import type { PackPart } from '@/tools/project-packer/lib/types';

// ============================================================
// PartOutput - 1 textarea readonly với button Copy + Download
// ============================================================

interface PartOutputProps {
  part: PackPart;
}

export default function PartOutput({ part }: PartOutputProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(part.content);
      setCopied(true);
      toast.success(`Đã copy Part ${part.index}/${part.total}`);
      // Reset icon sau 1.5s
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Không copy được, browser block clipboard');
    }
  }

  function handleDownload() {
    const blob = new Blob([part.content], { type: 'text/plain' });
    const filename =
      part.total === 1
        ? 'project-packed.txt'
        : `project-packed-part-${String(part.index).padStart(2, '0')}.txt`;
    downloadBlob(blob, filename);
  }

  return (
    <div className="border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">
            Part {part.index}/{part.total}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {part.charCount.toLocaleString('vi-VN')} ký tự
          </span>
          <span className="text-xs text-muted-foreground">
            ({part.fileNames.length} file)
          </span>
        </div>

        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <Download className="h-3 w-3" />
            Save
          </Button>
        </div>
      </div>

      {/* Content preview - readonly. Skip render nếu > 100K chars (tránh DOM lag) */}
      {part.charCount <= 100_000 ? (
        <textarea
          value={part.content}
          readOnly
          className="block max-h-48 w-full resize-none border-0 bg-background p-3 font-mono text-xs leading-relaxed focus:outline-none"
          rows={8}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
      ) : (
        <div className="border-t border-border bg-background px-3 py-4 text-center text-xs text-muted-foreground">
          Quá lớn để hiển thị ({part.charCount.toLocaleString('vi-VN')} ký tự). Dùng nút Copy hoặc Save.
        </div>
      )}
    </div>
  );
}