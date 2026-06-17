import { useEffect, useState } from 'react';
import { Languages, Loader2, X } from 'lucide-react';
import { translate } from '@/lib/reader/translate';

interface Props {
  text: string;
  onClose: () => void;
}

const TARGET_KEY = 'reader_translate_target';

export default function TranslatePopover({ text, onClose }: Props) {
  const [target, setTarget] = useState(() => localStorage.getItem(TARGET_KEY) || 'vi');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(TARGET_KEY, target);
  }, [target]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    translate({ text, source: 'auto', target })
      .then((r) => {
        if (cancelled) return;
        setResult(r.translated);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Translate failed');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [text, target]);

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
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-2 p-3 text-sm">
        <p className="line-clamp-3 text-xs text-zinc-500">{text}</p>
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