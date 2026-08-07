// ============================================================
// Image Studio — Compress Images workspace
// ============================================================

import { useState } from 'react';
import { Minimize2, Download, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared';
import { compressImage } from '../lib/image-operations';

interface CompressImagesWorkspaceProps {
  onBack: () => void;
}

const ACCEPT_IMAGES = '.png,.jpg,.jpeg,.webp';

export function CompressImagesWorkspace({ onBack }: CompressImagesWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; originalSize: number; compressedSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
      e.target.value = '';
    }
  };

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await compressImage(file);
      setResult({ blob, originalSize: file.size, compressedSize: blob.size });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nén thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace(/\.[^.]+$/, '_compressed$&') : 'compressed.jpg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reduction = result ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Minimize2 className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Nén ảnh</h2>
      </div>

      {!file && (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/30">
          <Minimize2 className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-foreground">Click để chọn ảnh</span>
          <span className="text-xs text-muted-foreground">PNG, JPG, WebP</span>
          <input type="file" accept={ACCEPT_IMAGES} className="sr-only" onChange={handleFileInput} />
        </label>
      )}

      {file && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="h-12 w-12 rounded object-cover"
            />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          </div>

          {isProcessing && <LoadingState variant="inline" label="Đang nén ảnh..." />}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {result && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">Nén xong — giảm {reduction}%</p>
              <p className="text-xs text-muted-foreground">
                {(result.originalSize / 1024).toFixed(0)} KB → {(result.compressedSize / 1024).toFixed(0)} KB
              </p>
              <Button size="sm" className="mt-2 gap-1.5" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                Tải ảnh nén
              </Button>
            </div>
          )}

          {!isProcessing && !result && (
            <Button onClick={handleCompress} className="gap-1.5">
              <Minimize2 className="h-4 w-4" />
              Nén
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
