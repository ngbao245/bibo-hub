
import { useState } from 'react';
import { Copy, Lock, Unlock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

import { encryptText, decryptText, isEncrypted } from '@/lib/crypto-utils';

import ToolModal from '@/components/ToolModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

// ============================================================
// Crypto Modal — AES-GCM 256 + PBKDF2 100k iter
// ============================================================

type Mode = 'encrypt' | 'decrypt';

export default function Crypto() {
  return (
    <ToolModal
      id="crypto"
      title="Mã hoá / Giải mã"
      description="AES-GCM 256 + PBKDF2 — passphrase share với Setting tool"
      className="max-w-lg"
    >
      <CryptoContent />
    </ToolModal>
  );
}

function CryptoContent() {
  const [passphrase, setPassphrase] = useState('');

  const [mode, setMode] = useState<Mode>('encrypt');
  const [showPass, setShowPass] = useState(false);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleProcess() {
    const text = input.trim();
    if (!text) {
      toast.error(mode === 'encrypt' ? 'Nhập text cần mã hoá' : 'Nhập payload cần giải mã');
      return;
    }
    if (!passphrase) {
      toast.error('Cần passphrase trước');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'encrypt') {
        setOutput(await encryptText(text, passphrase));
      } else {
        setOutput(await decryptText(text, passphrase));
      }
    } catch (e) {
      toast.error(mode === 'encrypt' ? 'Lỗi mã hoá' : 'Lỗi giải mã', {
        description: String((e as Error).message ?? e),
      });
      setOutput('');
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    toast.success('Đã sao chép');
  }

  function switchMode(next: Mode) {
    setMode(next);
    setInput('');
    setOutput('');
  }

  const inputLabel = mode === 'encrypt' ? 'Plaintext' : 'Ciphertext (v1:...)';
  const outputLabel = mode === 'encrypt' ? 'Ciphertext' : 'Plaintext';
  const placeholder =
    mode === 'encrypt' ? 'Văn bản cần mã hoá' : 'v1:abc...';

  return (
    <div className="space-y-4">
      {/* Passphrase */}
      <div className="space-y-2 border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            Passphrase
          </label>
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
            title={showPass ? 'Ẩn' : 'Hiện'}
          >
            {showPass ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
        <Input
          type={showPass ? 'text' : 'password'}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Nhập passphrase (giữ trong session, mất khi đóng tab)"
          autoComplete="off"
          className="font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Utility standalone — user tự chọn passphrase. Không share với auth/Setting.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 border border-border p-1">
        <ModeTab active={mode === 'encrypt'} onClick={() => switchMode('encrypt')}>
          <Lock className="h-3.5 w-3.5" />
          Mã hoá
        </ModeTab>
        <ModeTab active={mode === 'decrypt'} onClick={() => switchMode('decrypt')}>
          <Unlock className="h-3.5 w-3.5" />
          Giải mã
        </ModeTab>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {inputLabel}
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] w-full resize-y border border-input bg-background p-2 font-mono text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex items-center justify-between gap-2">
          {mode === 'decrypt' && input && !isEncrypted(input.trim()) && (
            <span className="text-[11px] text-warning">
              Payload thiếu prefix <code className="font-mono">v1:</code>
            </span>
          )}
          <Button
            onClick={handleProcess}
            disabled={busy || !passphrase}
            className="ml-auto gap-1.5"
          >
            {mode === 'encrypt' ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
            {busy ? 'Đang xử lý...' : mode === 'encrypt' ? 'Mã hoá' : 'Giải mã'}
          </Button>
        </div>
      </div>

      {/* Output */}
      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {outputLabel}
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 gap-1 px-2 text-xs"
            >
              <Copy className="h-3 w-3" />
              Sao chép
            </Button>
          </div>
          <div className="break-all border border-border bg-background p-3 font-mono text-xs text-primary">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}