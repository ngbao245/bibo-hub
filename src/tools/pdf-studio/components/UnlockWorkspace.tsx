// ============================================================
// PDF Studio — Unlock workspace
// ============================================================

import { useState } from 'react';
import { Unlock, Download } from 'lucide-react';
import { LoadingState, ErrorState } from '@/components/shared';
import { DropZone } from './DropZone';
import { unlockPdf } from '../lib/operations';
import { WorkspaceHeader } from './WorkspaceHeader';

interface UnlockWorkspaceProps {
  onBack: () => void;
}

export function UnlockWorkspace({ onBack }: UnlockWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (files: File[]) => {
    const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdf) { setFile(pdf); setResult(null); setError(null); }
  };

  const handleUnlock = async () => {
    if (!file || !password) return;
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await unlockPdf(file, password);
      setResult(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mở khóa thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace('.pdf', '_unlocked.pdf') : 'unlocked.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        icon={Unlock}
        title="Mở khóa PDF"
        subtitle={file ? file.name : 'Chọn PDF cần mở khóa'}
        onBack={onBack}
        primaryAction={
          result
            ? {
                icon: Download,
                label: 'Tải file đã mở khóa',
                onClick: handleDownload,
              }
            : file
              ? {
                  icon: Unlock,
                  label: 'Mở khóa',
                  onClick: handleUnlock,
                  disabled: !password || isProcessing,
                  loading: isProcessing,
                }
              : undefined
        }
      />

      {!file && <DropZone onFiles={handleFiles} maxFiles={1} />}

      {file && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card p-3 text-sm elev-surface">
            <p className="font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu PDF"
              className="h-9 flex-1 rounded border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
            />
          </div>

          {isProcessing && <LoadingState variant="inline" label="Đang mở khóa..." />}
          {error && <ErrorState compact message={error} />}

          {result && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">Mở khóa thành công</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
