import { useNavigate } from 'react-router-dom';
import { FileText, CheckSquare, Highlighter, BookOpen } from 'lucide-react';

import type { RagSearchResult } from '@/lib/rag/types';
import { useModalStore } from '@/stores/modalStore';
import { cn } from '@/lib/cn';

// ============================================================
// ResultCard — render 1 kết quả search
// ============================================================
//
// Click → navigate tới source:
//   note → /notes?id=<id>   (Notes page có thể tự handle query param)
//   task → /tasks
//   highlight → /reader (book detail nếu metadata.bookId có)
// ============================================================

const ICONS = {
  note: FileText,
  task: CheckSquare,
  highlight: Highlighter,
  book_chunk: BookOpen,
} as const;

const ENTITY_LABEL = {
  note: 'Note',
  task: 'Task',
  highlight: 'Highlight',
  book_chunk: 'Book',
} as const;

export default function ResultCard({
  result,
  query,
}: {
  result: RagSearchResult;
  query: string;
}) {
  const navigate = useNavigate();
  const closeModal = useModalStore((s) => s.close);
  const Icon = ICONS[result.entityType];

  function handleClick() {
    closeModal();
    const url = buildSourceUrl(result);
    if (url) navigate(url);
  }

  const similarityPct = Math.round(result.similarity * 100);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex w-full flex-col gap-1.5 border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-card/80 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {ENTITY_LABEL[result.entityType]}
        </span>
        <h3 className="flex-1 truncate text-sm font-semibold text-foreground">
          {result.title}
        </h3>
        <SimilarityBadge pct={similarityPct} />
      </div>

      <p className="line-clamp-3 text-xs text-muted-foreground">
        <HighlightedText text={result.snippet} query={query} />
      </p>

      {result.entityType === 'task' && <TaskBadges metadata={result.metadata} />}
    </button>
  );
}

// ------------------------------------------------------------
// SimilarityBadge
// ------------------------------------------------------------

function SimilarityBadge({ pct }: { pct: number }) {
  const cls = cn(
    'font-mono text-[10px] tabular-nums',
    pct >= 70 ? 'text-primary' : pct >= 50 ? 'text-foreground' : 'text-muted-foreground',
  );
  return <span className={cls}>{pct}%</span>;
}

// ------------------------------------------------------------
// HighlightedText — bold các từ trùng query
// ------------------------------------------------------------

function HighlightedText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;

  // Split text theo từng từ trong query (case-insensitive)
  const tokens = trimmed
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map(escapeRegExp);

  if (tokens.length === 0) return <>{text}</>;

  const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ------------------------------------------------------------
// TaskBadges
// ------------------------------------------------------------

function TaskBadges({ metadata }: { metadata: Record<string, unknown> }) {
  const status = typeof metadata.status === 'string' ? metadata.status : null;
  const priority = typeof metadata.priority === 'string' ? metadata.priority : null;
  const dueDate = typeof metadata.dueDate === 'string' ? metadata.dueDate : null;

  if (!status && !priority && !dueDate) return null;

  return (
    <div className="flex flex-wrap gap-1 pt-0.5">
      {status === 'pending' && (
        <span className="border border-warning/40 bg-warning/5 px-1.5 py-0.5 text-[10px] text-warning">
          pending
        </span>
      )}
      {status === 'completed' && (
        <span className="border border-primary/40 bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary">
          completed
        </span>
      )}
      {priority === 'high' && (
        <span className="border border-destructive/40 bg-destructive/5 px-1.5 py-0.5 text-[10px] text-destructive">
          high priority
        </span>
      )}
      {dueDate && (
        <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {dueDate.slice(0, 10)}
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// URL builder
// ------------------------------------------------------------

function buildSourceUrl(result: RagSearchResult): string | null {
  switch (result.entityType) {
    case 'note':
      return `/notes?noteId=${encodeURIComponent(result.id)}`;
    case 'task':
      return `/tasks?taskId=${encodeURIComponent(result.id)}`;
    case 'highlight': {
      const bookId = result.metadata.bookId;
      if (typeof bookId === 'string') {
        return `/reader/${encodeURIComponent(bookId)}?highlightId=${encodeURIComponent(result.id)}`;
      }
      return '/reader';
    }
    case 'book_chunk': {
      const bookId = result.metadata.bookId;
      const page = result.metadata.page;
      if (typeof bookId === 'string') {
        const pageParam = typeof page === 'number' ? `?page=${page}` : '';
        return `/reader/${encodeURIComponent(bookId)}${pageParam}`;
      }
      return '/reader';
    }
    default:
      return null;
  }
}