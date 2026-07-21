import { useEffect, useMemo, useState } from 'react';
import { Trash2, BookOpen, Image as ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/cacheInspect';
import {
  STORE_FILES,
  STORE_COVERS,
  listEntries,
  deleteCached,
  clearStore,
} from '@/tools/library/lib/blob-cache';
import { toast } from '@/components/ui/sonner';

// ============================================================
// IndexedDBTab — list/clear blob cache của Reader (files + covers)
// ============================================================

interface Props {
  refreshKey: number;
  onChange: () => void;
}

interface StoreEntry {
  key: string;
  size: number;
  last_accessed: number;
}

export default function IndexedDBTab({ refreshKey, onChange }: Props) {
  const [files, setFiles] = useState<StoreEntry[]>([]);
  const [covers, setCovers] = useState<StoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listEntries(STORE_FILES), listEntries(STORE_COVERS)])
      .then(([f, c]) => {
        if (cancelled) return;
        setFiles(f as StoreEntry[]);
        setCovers(c as StoreEntry[]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const totalFiles = useMemo(() => files.reduce((s, e) => s + e.size, 0), [files]);
  const totalCovers = useMemo(() => covers.reduce((s, e) => s + e.size, 0), [covers]);

  if (loading) {
    // Skeleton match footprint 2 StoreSection: header (icon + label + count)
    // + 3 entry rows. Shimmer sweep tự chạy từ base Skeleton component.
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Skeleton className="h-3.5 w-3.5" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="ml-auto h-3 w-16" />
            </div>
            <div className="space-y-0">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0">
                  <Skeleton className="h-2.5 flex-1" />
                  <Skeleton className="h-2.5 w-8 shrink-0" />
                  <Skeleton className="h-2.5 w-10 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0 && covers.length === 0) {
    return (
      <div className="border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Reader cache trống. Mở 1 cuốn sách để cache file + cover.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <StoreSection
        icon={<BookOpen className="h-3.5 w-3.5" />}
        label="Reader files (EPUB / PDF)"
        store={STORE_FILES}
        entries={files}
        totalSize={totalFiles}
        onChange={onChange}
      />
      <StoreSection
        icon={<ImageIcon className="h-3.5 w-3.5" />}
        label="Book covers"
        store={STORE_COVERS}
        entries={covers}
        totalSize={totalCovers}
        onChange={onChange}
      />
    </div>
  );
}

// ============================================================
function StoreSection({
  icon,
  label,
  store,
  entries,
  totalSize,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  store: string;
  entries: StoreEntry[];
  totalSize: number;
  onChange: () => void;
}) {
  async function clearAll() {
    if (!window.confirm(`Clear ${entries.length} entries in ${label}?`)) return;
    await clearStore(store);
    toast.success('Đã xoá');
    onChange();
  }

  async function remove(key: string) {
    await deleteCached(store, key);
    onChange();
  }

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-foreground">
          {icon}
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">
            ({entries.length}, {formatBytes(totalSize)})
          </span>
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">Trống</p>
      ) : (
        <div className="max-h-[40vh] overflow-y-auto">
          {entries
            .slice()
            .sort((a, b) => b.last_accessed - a.last_accessed)
            .map((e) => (
              <EntryRow key={e.key} entry={e} onRemove={() => remove(e.key)} />
            ))}
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry, onRemove }: { entry: StoreEntry; onRemove: () => void }) {
  const ago = formatRelative(entry.last_accessed);
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs last:border-b-0">
      <code className="flex-1 truncate font-mono text-[10px] text-muted-foreground" title={entry.key}>
        {entry.key}
      </code>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{ago}</span>
      <span className="shrink-0 font-mono text-[10px] text-foreground">
        {formatBytes(entry.size)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
        title="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}