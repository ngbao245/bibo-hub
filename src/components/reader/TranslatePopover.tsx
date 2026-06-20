import { useEffect, useState, useRef } from 'react';
import { Languages, Loader2, X } from 'lucide-react';
import { translate } from '@/lib/reader/translate';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  text: string;
  onClose: () => void;
}

const TARGET_KEY = 'reader_translate_target';
const REMOVE_LINEBREAK_KEY = 'reader_translate_remove_linebreak';

export default function TranslatePopover({ text, onClose }: Props) {
  const [target, setTarget] = useState(() => localStorage.getItem(TARGET_KEY) || 'vi');
  const [removeLinebreak, setRemoveLinebreak] = useState(
    () => localStorage.getItem(REMOVE_LINEBREAK_KEY) !== 'false' // Default true
  );
  const [editedText, setEditedText] = useState(text);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTranslated, setLastTranslated] = useState<{
    text: string;
    target: string;
  } | null>(null);

  // Track xem đã mount chưa để tránh auto-fix lúc init
  const isFirstMount = useRef(true);

  useEffect(() => {
    setEditedText(text);
  }, [text]);

  useEffect(() => {
    localStorage.setItem(TARGET_KEY, target);
  }, [target]);

  useEffect(() => {
    localStorage.setItem(REMOVE_LINEBREAK_KEY, String(removeLinebreak));
  }, [removeLinebreak]);

  // Khi toggle Unwrap ON → fix text hiện tại nếu có newlines
  // Skip lần đầu mount để không giựt
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (removeLinebreak) {
      setEditedText((prev) => prev.includes('\n') ? prev.replace(/\n+/g, ' ') : prev);
    }
  }, [removeLinebreak]);

  // Handle textarea change với auto-fix
  const handleTextChange = (newText: string) => {
    // Nếu removeLinebreak ON và text có newlines → tự động fix
    if (removeLinebreak && newText.includes('\n')) {
      setEditedText(newText.replace(/\n+/g, ' '));
    } else {
      setEditedText(newText);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const doTranslate = () => {
      let cleanText = removeLinebreak ? editedText.replace(/\n+/g, ' ') : editedText;
      cleanText = cleanText.trim();

      // Skip nếu text rỗng
      if (!cleanText) {
        setResult(null);
        setError(null);
        setLastTranslated(null); // Clear cache khi xóa hết text
        return;
      }

      // Check nếu đã dịch rồi thì skip
      if (
        lastTranslated &&
        lastTranslated.text === cleanText &&
        lastTranslated.target === target
      ) {
        return;
      }

      setLoading(true);
      setError(null);
      translate({ text: cleanText, source: 'auto', target })
        .then((r) => {
          if (cancelled) return;
          setResult(r.translated);
          setLastTranslated({ text: cleanText, target });
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : 'Translate failed');
        })
        .finally(() => !cancelled && setLoading(false));
    };

    // Debounce 1 giây
    timeoutId = window.setTimeout(doTranslate, 1000);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [editedText, target, removeLinebreak, lastTranslated]);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 border border-zinc-700 bg-zinc-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <Languages className="h-3.5 w-3.5" />
          <span>Translate</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-[11px] outline-none"
          >
            <option value="vi">Vietnamese</option>
            <option value="en">English</option>
            <option value="ja">Japanese</option>
            <option value="zh-CN">Chinese</option>
            <option value="ko">Korean</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="es">Spanish</option>
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-400">
            <Checkbox
              checked={removeLinebreak}
              onCheckedChange={(checked) => setRemoveLinebreak(checked === true)}
              className="h-3.5 w-3.5"
            />
            <span>Unwrap</span>
          </label>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-2 p-3 text-sm">
        <textarea
          value={editedText}
          onChange={(e) => handleTextChange(e.target.value)}
          className="w-full resize-none border border-zinc-700 bg-zinc-800 p-2 text-xs text-zinc-200 outline-none focus:border-primary"
          rows={3}
        />
        <div className="border-t border-zinc-800 pt-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Translating…
            </div>
          ) : error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : (
            <p className="whitespace-pre-wrap text-zinc-100">{result}</p>
          )}
        </div>
      </div>
    </div>
  );
}