import { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { searchPdf, type PdfSearchMatch } from '@/lib/reader/pdf-search';

interface Props {
  /** PDFDocumentProxy from react-pdf */
  doc: unknown;
  onJump: (page: number) => void;
}

export default function PdfSearchTab({ doc, onJump }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PdfSearchMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search 300ms
  useEffect(() => {
    if (!doc) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchPdf(doc, q, { limit: 100 })
        .then(setResults)
        .catch((e) => setError(e instanceof Error ? e.message : 'Search failed'))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [doc, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 p-2">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trong sách…"
            autoFocus
            className="w-full border border-zinc-800 bg-zinc-900 py-1.5 pl-7 pr-7 text-xs outline-none focus:border-sky-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div>
            {/* Skeleton match ResultList: header count + N group card (page label + 2 preview lines) */}
            <div className="border-b border-zinc-800 px-3 py-1.5">
              <Skeleton className="h-2.5 w-32 bg-zinc-800" />
            </div>
            <ul className="divide-y divide-zinc-800">
              {[0, 1, 2].map((i) => (
                <li key={i} className="px-3 py-2">
                  <Skeleton className="h-2.5 w-20 bg-zinc-800" />
                  <Skeleton className="mt-1.5 h-3 w-full bg-zinc-800" />
                  <Skeleton className="mt-1 h-3 w-4/5 bg-zinc-800" />
                </li>
              ))}
            </ul>
          </div>
        )}
        {!loading && error && <p className="p-4 text-xs text-red-400">{error}</p>}
        {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
          <p className="p-4 text-xs text-zinc-500">Không tìm thấy "{query.trim()}".</p>
        )}
        {!loading && results.length > 0 && (
          <ResultList results={results} onJump={onJump} />
        )}
        {!loading && query.trim().length < 2 && (
          <p className="p-4 text-xs text-zinc-500">
            Gõ ít nhất 2 ký tự để tìm. Search index lazy build ở lần đầu, sau đó instant.
          </p>
        )}
      </div>
    </div>
  );
}

function ResultList({
  results,
  onJump,
}: {
  results: PdfSearchMatch[];
  onJump: (page: number) => void;
}) {
  // Group by page
  const groups = useMemo(() => {
    const m = new Map<number, PdfSearchMatch[]>();
    for (const r of results) {
      const arr = m.get(r.page) ?? [];
      arr.push(r);
      m.set(r.page, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [results]);

  return (
    <div>
      <p className="border-b border-zinc-800 px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        {results.length} kết quả · {groups.length} trang
      </p>
      <ul className="divide-y divide-zinc-800">
        {groups.map(([page, matches]) => (
          <li key={page}>
            <button
              onClick={() => onJump(page)}
              className="block w-full px-3 py-2 text-left hover:bg-zinc-900"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-sky-400">
                Trang {page}
                <span className="ml-2 text-zinc-600">{matches.length} match</span>
              </p>
              {matches.slice(0, 3).map((m, i) => (
                <p key={i} className="mt-0.5 line-clamp-2 text-xs text-zinc-300">
                  {renderHighlighted(m)}
                </p>
              ))}
              {matches.length > 3 && (
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  + {matches.length - 3} match khác
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderHighlighted(m: PdfSearchMatch) {
  const before = m.preview.slice(0, m.highlightStart);
  const hit = m.preview.slice(m.highlightStart, m.highlightEnd);
  const after = m.preview.slice(m.highlightEnd);
  return (
    <>
      {before}
      <mark className="bg-sky-500/30 text-sky-200">{hit}</mark>
      {after}
    </>
  );
}