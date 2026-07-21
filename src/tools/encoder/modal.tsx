
import { useState } from 'react';
import { Copy, KeyRound, Unlock } from 'lucide-react';

import ToolModal from '@/components/ToolModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

// ============================================================
// Encoder Modal — encode/decode API URL cho config.ts
// ============================================================

type Mode = 'encode' | 'decode';

export default function Encoder() {
  return (
    <ToolModal
      id="encoder"
      title="Mã hoá / Giải mã API URL"
      description="Encode URL để dán vào config.ts, hoặc decode chuỗi để kiểm tra"
      className="max-w-lg"
    >
      <EncoderContent />
    </ToolModal>
  );
}

function EncoderContent() {
  const [mode, setMode] = useState<Mode>('encode');
  const [input, setInput] = useState('https://example.mockapi.io');
  const [output, setOutput] = useState('');

  function handleProcess() {
    const trimmed = input.trim();
    if (!trimmed) {
      toast.error(mode === 'encode' ? 'Vui lòng nhập URL' : 'Vui lòng nhập chuỗi đã mã hoá');
      return;
    }
    try {
      setOutput(mode === 'encode' ? encodeApiUrl(trimmed) : decodeApiUrl(trimmed));
    } catch (e) {
      toast.error(mode === 'encode' ? 'Lỗi mã hoá' : 'Lỗi giải mã', { description: String(e) });
      setOutput('');
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

  const inputLabel = mode === 'encode' ? 'API URL' : 'Chuỗi đã mã hoá';
  const outputLabel = mode === 'encode' ? 'Encoded' : 'URL gốc';
  const placeholder =
    mode === 'encode' ? 'https://your-api.mockapi.io/api/v1' : 'b2kuaXBha2Nv...';

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-1 border border-border p-1">
        <ModeTab active={mode === 'encode'} onClick={() => switchMode('encode')}>
          <KeyRound className="h-3.5 w-3.5" />
          Mã hoá
        </ModeTab>
        <ModeTab active={mode === 'decode'} onClick={() => switchMode('decode')}>
          <Unlock className="h-3.5 w-3.5" />
          Giải mã
        </ModeTab>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {inputLabel}
        </label>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleProcess()}
            placeholder={placeholder}
            className="font-mono text-xs"
          />
          <Button onClick={handleProcess} className="gap-1.5 shrink-0">
            {mode === 'encode' ? (
              <KeyRound className="h-4 w-4" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
            {mode === 'encode' ? 'Mã hoá' : 'Giải mã'}
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
          {mode === 'encode' && (
            <p className="text-xs text-muted-foreground">
              Dán giá trị này vào <code className="font-mono text-foreground">ENCODED_API_BASE</code>{' '}
              trong file <code className="font-mono text-foreground">src/lib/config.ts</code>.
            </p>
          )}
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

// ============================================================
// Encode/decode logic (đối xứng với lib/config.ts)
// ============================================================

function encodeApiUrl(url: string): string {
  // UTF-8 → bytes
  const utf8Bytes = new TextEncoder().encode(url);
  // Bytes → binary string
  let binaryString = '';
  utf8Bytes.forEach((byte) => {
    binaryString += String.fromCharCode(byte);
  });
  // Reverse + base64
  return btoa(binaryString.split('').reverse().join(''));
}

function decodeApiUrl(encoded: string): string {
  // Base64 → reverse → UTF-8
  const reversed = atob(encoded.trim()).split('').reverse().join('');
  const bytes = new Uint8Array(reversed.length);
  for (let i = 0; i < reversed.length; i++) {
    bytes[i] = reversed.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}