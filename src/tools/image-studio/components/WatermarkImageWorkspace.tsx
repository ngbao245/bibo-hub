// ============================================================
// Image Studio — Add Watermark to Image workspace
// ============================================================

import { useState } from 'react';
import { Stamp, Download, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared';
import { addWatermarkImage } from '../lib/image-operations';

interface WatermarkImageWorkspaceProps {
  onBack: () => void;
}

export function WatermarkImageWorkspace({ onBack }: WatermarkImageWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [position, setPosition] = useState<'center' | 'bottom-right' | 'top-left'>('center');
  const [opacity, setOpacity] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
      e.target.value = '';
    }
  };

  const handleApply = async () => {
    if (!file || !text.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await addWatermarkImage(file, { text, position, opacity });
      setResult(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm watermark thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace(/\.[^.]+$/, '_watermarked$&') : 'watermarked.jpg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Stamp className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Thêm Watermark (Ảnh)</h2>
      </div>

      {!file && (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/30">
          <Stamp className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-foreground">Click để chọn ảnh</span>
          <input type="file" accept=".png,.jpg,.jpeg" className="sr-only" onChange={handleFileInput} />
        </label>
      )}

      {file && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
            <img src={URL.createObjectURL(file)} alt={file.name} className="h-12 w-12 rounded object-cover" />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          </div>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nhập text watermark"
            className="h-9 w-full rounded border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Vị trí:</span>
            {([['center', 'Giữa'], ['bottom-right', 'Dưới phải'], ['top-left', 'Trên trái']] as const).map(([pos, label]) => (
              <button
                key={pos}
                onClick={() => setPosition(pos as typeof position)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  position === pos ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Opacity:</span>
            <input
              type="range"
              min="10"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">{opacity}%</span>
          </div>

          {isProcessing && <LoadingState variant="inline" label="Đang thêm watermark..." />}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {result && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">Thêm watermark xong</p>
              <Button size="sm" className="mt-2 gap-1.5" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                Tải ảnh
              </Button>
            </div>
          )}

          {!isProcessing && !result && text.trim() && (
            <Button onClick={handleApply} className="gap-1.5">
              <Stamp className="h-4 w-4" />
              Thêm Watermark
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
