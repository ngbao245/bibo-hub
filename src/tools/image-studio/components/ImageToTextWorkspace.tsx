// ============================================================
// Image Studio — Image to Text (OCR) workspace
// ============================================================

import { useState } from 'react';
import { FileText, Download, ArrowLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared';
import { imageToText } from '../lib/image-operations';

interface ImageToTextWorkspaceProps {
  onBack: () => void;
}

const ACCEPT_IMAGES = '.png,.jpg,.jpeg,.webp,.bmp,.gif';

export function ImageToTextWorkspace({ onBack }: ImageToTextWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setText(null);
      setError(null);
      e.target.value = '';
    }
  };

  const handleOcr = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await imageToText(file);
      setText(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace(/\.[^.]+$/, '.txt') : 'text.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Ảnh → Văn bản</h2>
        <span className="text-xs text-muted-foreground">OCR trích xuất text từ ảnh</span>
      </div>

      {!file && (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/30">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-foreground">Click để chọn ảnh chứa text</span>
          <span className="text-xs text-muted-foreground">PNG, JPG, WebP, BMP, GIF</span>
          <input type="file" accept={ACCEPT_IMAGES} className="sr-only" onChange={handleFileInput} />
        </label>
      )}

      {file && !text && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="h-16 w-auto max-w-[200px] rounded object-contain"
            />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          </div>

          {isProcessing && <LoadingState variant="inline" label="Đang nhận dạng text..." />}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {!isProcessing && (
            <Button onClick={handleOcr} className="gap-1.5">
              <FileText className="h-4 w-4" />
              Trích xuất text
            </Button>
          )}
        </div>
      )}

      {text && (
        <div className="space-y-3">
          <div className="relative rounded-lg border border-border bg-card p-4">
            <pre className="whitespace-pre-wrap text-sm text-foreground font-mono max-h-80 overflow-y-auto">
              {text}
            </pre>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Đã copy' : 'Copy text'}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" />
              Tải .txt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
