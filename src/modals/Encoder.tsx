import { useState, useCallback } from 'react';
import { Copy, KeyRound } from 'lucide-react';

import { useShortcut } from '@/hooks/useShortcut';
import { useModalStore } from '@/stores/modalStore';
import ToolModal from '@/components/ToolModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';

// ============================================================
// Encoder Modal - encode API URL cho config.ts
// ============================================================
//
// Logic encode đối xứng với decode trong lib/config.ts:
// 1. UTF-8 encode (cho phép URL có ký tự Unicode/Vietnamese)
// 2. Bytes → binary string
// 3. Reverse string
// 4. Base64 encode
//
// Output dán vào lib/config.ts (constant ENCODED_API_BASE).
// ============================================================

export default function Encoder() {
  const toggle = useModalStore((s) => s.toggle);
  const handleShortcut = useCallback(() => toggle('encoder'), [toggle]);

  useShortcut({
    key: 'alt+e',
    label: 'Encoder',
    group: 'Tools',
    handler: handleShortcut,
  });

  return (
    <ToolModal
      id="encoder"
      title="Mã hoá API URL"
      description="Dán URL MockAPI để tạo encoded string cho config.ts"
      className="max-w-lg"
    >
      <EncoderContent />
    </ToolModal>
  );
}

function EncoderContent() {
  const [url, setUrl] = useState('https://example.mockapi.io');
  const [encoded, setEncoded] = useState('');

  function handleEncode() {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập URL');
      return;
    }
    try {
      setEncoded(encodeApiUrl(trimmed));
    } catch (e) {
      toast.error('Lỗi mã hoá', { description: String(e) });
    }
  }

  function handleCopy() {
    if (!encoded) return;
    navigator.clipboard.writeText(encoded);
    toast.success('Đã sao chép', { description: 'Dán vào lib/config.ts' });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          API URL
        </label>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEncode()}
            placeholder="https://your-api.mockapi.io/api/v1"
          />
          <Button onClick={handleEncode} className="gap-1.5">
            <KeyRound className="h-4 w-4" />
            Mã hoá
          </Button>
        </div>
      </div>

      {encoded && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Encoded
            </label>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 gap-1 px-2 text-xs">
              <Copy className="h-3 w-3" />
              Sao chép
            </Button>
          </div>
          <div className="break-all border border-border bg-background p-3 font-mono text-xs text-primary">
            {encoded}
          </div>
          <p className="text-xs text-muted-foreground">
            Dán giá trị này vào <code className="font-mono text-foreground">ENCODED_API_BASE</code>{' '}
            trong file <code className="font-mono text-foreground">src/lib/config.ts</code>.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Logic encode (đối xứng với decode trong lib/config.ts)
// ============================================================
function encodeApiUrl(url: string): string {
  // UTF-8 → bytes (hỗ trợ ký tự Unicode/Vietnamese)
  const utf8Bytes = new TextEncoder().encode(url);

  // Bytes → binary string (mỗi byte là 1 char trong [0-255])
  let binaryString = '';
  utf8Bytes.forEach((byte) => {
    binaryString += String.fromCharCode(byte);
  });

  // Reverse string + base64 encode
  return btoa(binaryString.split('').reverse().join(''));
}
