// ============================================================
// Image Studio — Merge Images workspace (images → 1 PDF)
// ============================================================

import { useState } from 'react';
import { Combine, Download, ArrowLeft, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared';
import { mergeImagesToPdf } from '../lib/image-operations';

interface MergeImagesWorkspaceProps {
  onBack: () => void;
}

const ACCEPT_IMAGES = '.png,.jpg,.jpeg,.webp,.bmp,.gif';

export function MergeImagesWorkspace({ onBack }: MergeImagesWorkspaceProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const images = Array.from(e.target.files).filter((f) => f.type.startsWith('image/'));
      setFiles((prev) => [...prev, ...images]);
      setResult(null);
      setError(null);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const moveFile = (from: number, to: number) => {
    setFiles((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  const handleMerge = async () => {
    if (files.length < 1) return;
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await mergeImagesToPdf(files);
      setResult(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gộp thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merged_images.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Combine className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Gộp ảnh → PDF</h2>
      </div>

      {/* File picker */}
      <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/30">
        <Combine className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm text-foreground">Click để chọn ảnh</span>
        <span className="text-xs text-muted-foreground">PNG, JPG, WebP, BMP, GIF</span>
        <input type="file" multiple accept={ACCEPT_IMAGES} className="sr-only" onChange={handleFileInput} />
      </label>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-8 w-8 rounded object-cover"
              />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
              {i > 0 && <button onClick={() => moveFile(i, i - 1)} className="text-xs text-muted-foreground hover:text-foreground">↑</button>}
              {i < files.length - 1 && <button onClick={() => moveFile(i, i + 1)} className="text-xs text-muted-foreground hover:text-foreground">↓</button>}
              <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {isProcessing && <LoadingState variant="inline" label="Đang gộp ảnh..." />}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {result && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">Gộp xong — {files.length} ảnh → 1 PDF</p>
              <Button size="sm" className="mt-2 gap-1.5" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                Tải PDF
              </Button>
            </div>
          )}

          {!isProcessing && !result && (
            <Button onClick={handleMerge} className="gap-1.5">
              <Combine className="h-4 w-4" />
              Gộp {files.length} ảnh → PDF
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
