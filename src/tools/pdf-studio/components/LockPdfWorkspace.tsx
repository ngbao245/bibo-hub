// ============================================================
// PDF Studio — Lock workspace (add password to PDF)
// ============================================================
// Server-side via iLovePDF protect endpoint (pdf-lib không support
// encryption). Yêu cầu password + confirm password khớp trước khi lock.
// ============================================================

import { useState } from 'react';
import { Lock, Download, Eye, EyeOff } from 'lucide-react';
import { LoadingState, ErrorState } from '@/components/shared';
import { DropZone } from './DropZone';
import { lockPdf } from '../lib/operations';
import { WorkspaceHeader } from './WorkspaceHeader';

interface LockPdfWorkspaceProps {
  onBack: () => void;
}

export function LockPdfWorkspace({ onBack }: LockPdfWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = !!file && passwordsMatch && !isProcessing;

  const handleFiles = (files: File[]) => {
    const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdf) {
      setFile(pdf);
      setResult(null);
      setError(null);
    }
  };

  const handleLock = async () => {
    if (!canSubmit) return;
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await lockPdf(file!, password);
      setResult(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Khoá PDF thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace('.pdf', '_locked.pdf') : 'locked.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        icon={Lock}
        title="Khoá PDF"
        subtitle={file ? file.name : 'Chọn PDF cần khoá bằng mật khẩu'}
        onBack={onBack}
        primaryAction={
          result
            ? {
                icon: Download,
                label: 'Tải file đã khoá',
                onClick: handleDownload,
              }
            : file
              ? {
                  icon: Lock,
                  label: 'Khoá PDF',
                  onClick: handleLock,
                  disabled: !canSubmit,
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
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu mới"
                className="h-9 w-full rounded border border-input bg-background pl-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title={showPassword ? 'Ẩn' : 'Hiện'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              className="h-9 w-full rounded border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) handleLock();
              }}
            />
            {password.length > 0 && confirm.length > 0 && !passwordsMatch && (
              <ErrorState compact message="Mật khẩu không khớp" />
            )}
            {password.length > 0 && password.length < 4 && (
              <p className="text-xs text-warning">Mật khẩu ngắn — nên ≥ 4 ký tự</p>
            )}
          </div>

          <div className="rounded border border-warning/40 bg-warning/5 p-2.5 text-xs text-warning">
            [!] Lưu lại mật khẩu ở nơi an toàn. Mất mật khẩu = không mở được file
            (chỉ có thể mở khoá qua tool Mở khoá nếu biết mật khẩu).
          </div>

          {isProcessing && <LoadingState variant="inline" label="Đang khoá..." />}
          {error && <ErrorState compact message={error} />}

          {result && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
              <p className="font-medium text-success">Đã khoá PDF thành công</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                File mới cần mật khẩu để mở.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
