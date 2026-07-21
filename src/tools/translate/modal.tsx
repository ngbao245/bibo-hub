
import { useState, useEffect, useRef } from 'react';
import { Copy, Trash2, ArrowDown, Loader2 } from 'lucide-react';

import ToolModal from '@/components/ToolModal';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

// ============================================================
// Translate Modal — dịch Việt-Anh tự động qua MyMemory API
// ============================================================

const VIETNAMESE_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

export default function Translate() {
  return (
    <ToolModal
      id="translate"
      title="Dịch thuật"
      description="Tự động phát hiện Việt-Anh"
      className="max-w-xl"
    >
      <TranslateContent />
    </ToolModal>
  );
}

// ============================================================
function TranslateContent() {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [direction, setDirection] = useState<{ from: string; to: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // useRef giữ timeout id giữa các render mà không trigger re-render.
  // Khác với useState: thay đổi ref.current không re-render component.
  const timeoutRef = useRef<number | null>(null);

  // 📚 GIẢI THÍCH useEffect Ở ĐÂY:
  //
  // Effect chạy mỗi khi `source` (text user gõ) thay đổi.
  // Nếu rỗng → clear target ngay.
  // Nếu có text → set timeout 500ms rồi mới gọi API (debounce).
  //
  // Cleanup function: clear timeout của lần render trước.
  // Cách này → mỗi lần user gõ ký tự mới, timeout cũ bị huỷ, timeout mới được set.
  // Chỉ khi user dừng gõ 500ms, timeout cuối cùng mới chạy → 1 request duy nhất.
  //
  // Thiếu cleanup → mỗi ký tự gõ tạo 1 timeout riêng → bao nhiêu ký tự là bấy nhiêu request.
  useEffect(() => {
    if (!source.trim()) {
      setTarget('');
      setDirection(null);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      doTranslate(source);
    }, 500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [source]);

  /** Gọi MyMemory API. Nếu lỗi/quota, fallback Lingva. Cuối cùng cho user mở Google Translate. */
  async function doTranslate(text: string) {
    const isVi = VIETNAMESE_REGEX.test(text);
    const from = isVi ? 'vi' : 'en';
    const to = isVi ? 'en' : 'vi';

    setDirection({ from, to });
    setIsTranslating(true);

    try {
      const result = await translateWithFallback(text, from, to);
      setTarget(result);
    } catch {
      setTarget('');
      toast.error('Không dịch được, thử mở Google Translate', {
        action: {
          label: 'Mở',
          onClick: () => openGoogleTranslate(text, from, to),
        },
      });
    } finally {
      setIsTranslating(false);
    }
  }

  function copyResult() {
    if (!target) return;
    navigator.clipboard.writeText(target);
    toast.success('Đã sao chép');
  }

  function clearAll() {
    setSource('');
    setTarget('');
  }

  return (
    <div className="space-y-3">
      {/* Source input */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {direction ? labelFor(direction.from) : 'Văn bản gốc'}
          </span>
          {source && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 gap-1 px-2 text-xs">
              <Trash2 className="h-3 w-3" />
              Xoá
            </Button>
          )}
        </div>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Nhập văn bản cần dịch..."
          className="min-h-[100px] w-full resize-none border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
      </div>

      {/* Direction indicator */}
      <div className="flex items-center justify-center text-muted-foreground">
        {isTranslating ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </div>

      {/* Target output */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {direction ? labelFor(direction.to) : 'Bản dịch'}
          </span>
          {target && (
            <Button variant="ghost" size="sm" onClick={copyResult} className="h-6 gap-1 px-2 text-xs">
              <Copy className="h-3 w-3" />
              Sao chép
            </Button>
          )}
        </div>
        <textarea
          value={target}
          readOnly
          placeholder="Bản dịch sẽ hiển thị ở đây"
          className="min-h-[100px] w-full resize-none border border-input bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}

function labelFor(code: string): string {
  return code === 'vi' ? 'Tiếng Việt' : 'English';
}

// ============================================================
// Translation backends - fallback chain
// ============================================================
//
// 1. MyMemory: free, không cần key, 5000 ký tự/ngày anonymous
// 2. Lingva: free wrapper Google Translate, không cần key
// 3. Mở Google Translate trong tab mới (last resort)
//
// Nếu API trả response lỗi (status != ok hoặc translatedText rỗng),
// throw để chain rơi qua provider tiếp theo.
// ============================================================

async function translateWithFallback(text: string, from: string, to: string): Promise<string> {
  // Provider 1: MyMemory
  try {
    const result = await translateMyMemory(text, from, to);
    if (result) return result;
  } catch {
    // ignore, fallback Lingva
  }

  // Provider 2: Lingva
  try {
    const result = await translateLingva(text, from, to);
    if (result) return result;
  } catch {
    // ignore, throw để gọi onError
  }

  throw new Error('All translation providers failed');
}

async function translateMyMemory(text: string, from: string, to: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory ${res.status}`);
  const data = await res.json();

  // MyMemory trả responseStatus = 200 khi OK, 403 khi quota.
  // Cũng có khi trả responseData.translatedText = "MYMEMORY WARNING: ..."
  // → check translation match score để loại lỗi.
  const translation = data.responseData?.translatedText;
  if (!translation) throw new Error('Empty translation');
  if (typeof translation === 'string' && translation.toUpperCase().includes('MYMEMORY')) {
    throw new Error('MyMemory quota');
  }
  return translation;
}

async function translateLingva(text: string, from: string, to: string): Promise<string> {
  // Lingva có nhiều instance public, dùng instance chính
  const url = `https://lingva.ml/api/v1/${from}/${to}/${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Lingva ${res.status}`);
  const data = await res.json();
  if (!data.translation) throw new Error('Empty translation');
  return data.translation;
}

function openGoogleTranslate(text: string, from: string, to: string) {
  const url = `https://translate.google.com/?sl=${from}&tl=${to}&text=${encodeURIComponent(text)}&op=translate`;
  window.open(url, '_blank', 'noopener,noreferrer');
}