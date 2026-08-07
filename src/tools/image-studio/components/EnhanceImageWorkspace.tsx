// ============================================================
// Image Studio — Enhance Image (Upscale) workspace
// ============================================================

import { useState } from 'react';
import { ZoomIn, Download, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared';
import { upscaleImage } from '../lib/image-operations';

interface EnhanceImageWorkspaceProps {
  onBack: () => void;
}

const ACCEPT_IMAGES = '.png,.jpg,.jpeg';

export function EnhanceImageWorkspace({ onBack }: EnhanceImageWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [scale, setScale] = useState<2 | 4>(2);
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

  const handleUpscale = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await upscaleImage(file, scale);
      setResult(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upscale thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace(/\.[^.]+$/, `_${scale}x$&`) : `upscaled_${scale}x.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <ZoomIn className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Tăng độ phân giải</h2>
        <span className="text-xs text-muted-foreground">Upscale ảnh bằng AI</span>
      </div>

      {!file && (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/30">
          <ZoomIn className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-foreground">Click để chọn ảnh</span>
          <span className="text-xs text-muted-foreground">PNG, JPG</span>
          <input type="file" accept={ACCEPT_IMAGES} className="sr-only" onChange={handleFileInput} />
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

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Mức phóng:</span>
            {([2, 4] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  scale === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {isProcessing && <LoadingState variant="inline" label="Đang upscale..." />}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {result && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">Upscale {scale}x xong</p>
              <Button size="sm" className="mt-2 gap-1.5" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                Tải ảnh
              </Button>
            </div>
          )}

          {!isProcessing && !result && (
            <Button onClick={handleUpscale} className="gap-1.5">
              <ZoomIn className="h-4 w-4" />
              Upscale {scale}x
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
