import { useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

import { useRagSearch } from '@/api/rag';
import { useRagStore } from '@/stores/ragStore';
import type { EntityType } from '@/lib/rag/types';

import ResultCard from './ResultCard';

// ============================================================
// SearchTab — semantic search trên notes / tasks / highlights
// ============================================================

const FILTER_OPTIONS: Array<{ value: EntityType | 'all'; label: string }> = [
  { value: 'all',       label: 'Tất cả' },
  { value: 'note',      label: 'Notes' },
  { value: 'task',      label: 'Tasks' },
  { value: 'highlight', label: 'Highlights' },
];

export default function SearchTab() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<EntityType | 'all'>('all');
  const status = useRagStore((s) => s.status);

  const filterTypes = filter === 'all' ? undefined : [filter];

  const searchQuery = useRagSearch(query, { filterTypes, limit: 12 });
  const trimmed = query.trim();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Search input + filter chips */}
      <div className="flex flex-col gap-2 border-b border-border bg-popover/30 px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hỏi gì? Vd: ielts từ vựng, task gấp, highlight về react..."
            className="h-10 pl-9 pr-9 text-sm"
            disabled={status !== 'ready'}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              title="Clear"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter chips — segmented */}
        <div className="flex">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                'border border-border px-2.5 py-1 text-[11px] font-medium transition-colors',
                '-ml-px first:ml-0',
                filter === opt.value
                  ? 'z-10 border-primary bg-primary/10 text-primary'
                  : 'bg-background text-muted-foreground hover:bg-popover hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <Body
          status={status}
          query={trimmed}
          isLoading={searchQuery.isFetching}
          isError={searchQuery.isError}
          error={searchQuery.error}
          results={searchQuery.data?.results ?? []}
        />
      </div>
    </div>
  );
}

// ============================================================
// Body — render theo state
// ============================================================

function Body({
  status,
  query,
  isLoading,
  isError,
  error,
  results,
}: {
  status: string;
  query: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  results: Array<import('@/lib/rag/types').RagSearchResult>;
}) {
  if (status === 'needs_setup') {
    return (
      <EmptyState
        title="Chưa setup RAG"
        message="Cần ít nhất 1 Gemini API key để dùng semantic search."
        cta={
          <a
            href="/config"
            className="text-primary hover:underline"
          >
            Mở Config → AI Agentic
          </a>
        }
      />
    );
  }

  if (status === 'error') {
    return (
      <EmptyState
        title="Lỗi bootstrap"
        message="RAG không khởi động được. Check console để xem chi tiết."
      />
    );
  }

  if (status !== 'ready') {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Đang load RAG...
      </div>
    );
  }

  if (!query) {
    return (
      <EmptyState
        title="Bắt đầu gõ để search"
        message="Hỏi câu tự nhiên, AI sẽ tìm note / task / highlight liên quan."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Đang search...
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Search lỗi"
        message={error instanceof Error ? error.message : 'Unknown error'}
      />
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        title="Không tìm thấy"
        message={`Không có kết quả cho "${query}". Thử query khác hoặc giảm filter.`}
      />
    );
  }

  return (
    <div className="space-y-2 pb-3">
      {results.map((r) => (
        <ResultCard key={`${r.entityType}:${r.id}`} result={r} query={query} />
      ))}
    </div>
  );
}

// ============================================================
// EmptyState
// ============================================================

function EmptyState({
  title,
  message,
  cta,
}: {
  title: string;
  message: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center border border-border bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>
      {cta && <div className="mt-1 text-xs">{cta}</div>}
    </div>
  );
}