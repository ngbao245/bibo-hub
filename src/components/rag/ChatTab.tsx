import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Book,
  Globe,
  Loader2,
  Send,
  Sparkles,
  Square,
  Trash2,
  FileText,
  CheckSquare,
  Highlighter,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

import { useModalStore } from '@/stores/modalStore';
import { useRagStore, selectIsReady } from '@/stores/ragStore';
import { useReaderStore } from '@/stores/readerStore';
import { ragRetrieve } from '@/lib/rag/search';
import { chatStream, type ChatMessage as GeminiMessage } from '@/lib/rag/gemini';
import {
  extractBookContext,
  formatBookContext,
} from '@/lib/rag/book-context';
import {
  formatChunksAsContext,
  promptAutoWithContext,
  promptBookContext,
  promptInternal,
  PROMPT_AUTO_NO_CONTEXT,
} from '@/lib/rag/prompts';
import { renderMarkdown } from '@/lib/markdown-preview/render';
import type { EntityType, RagMatchRow } from '@/lib/rag/types';

// ============================================================
// ChatTab — RAG hybrid chat
// ============================================================
//
// 3 modes (toggle ở top):
//   Auto:     retrieve → maxSim >= threshold: cite notes, else LLM thuần
//   Internal: ép dùng context, không có thì "không biết"
//   Book:     skip vector retrieve. Extract text trang [N-10, N+10] từ
//             PDF đang mở → prompt + cite [p.X]. Disable khi không có
//             reader active.
//
// Streaming: token-by-token vào message cuối (plaintext).
// Khi stream xong: parse markdown + bind citation thành button click:
//   - Auto/Internal: [n] → navigate tới note/task/highlight
//   - Book: [p.X] → navigate tới /reader/:bookId?page=X
// AbortController: nút Stop hủy generation.
// Clear: xóa toàn bộ messages session-only.
// ============================================================

type Badge = 'internal' | 'auto_context' | 'auto_pure' | 'book';

interface Source {
  index: number;
  entityType: EntityType;
  entityId: string;
  title: string;
  metadata: Record<string, unknown>;
}

/** Snapshot reader scope khi gửi message ở Book mode. */
interface BookScope {
  bookId: string;
  bookTitle: string;
  currentPage: number;
  fromPage: number;
  toPage: number;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources: Source[];
  /** Set khi message ở Book mode để citation [p.X] click navigate được. */
  bookScope: BookScope | null;
  badge: Badge | null;
  /** True khi đang streaming → render plaintext. False → render markdown. */
  streaming: boolean;
}

export default function ChatTab() {
  const isReady = useRagStore(selectIsReady);
  const status = useRagStore((s) => s.status);
  const config = useRagStore((s) => s.config);
  const chatMode = useRagStore((s) => s.chatMode);
  const setChatMode = useRagStore((s) => s.setChatMode);
  const pendingPrompt = useRagStore((s) => s.pendingPrompt);
  const clearPendingPrompt = useRagStore((s) => s.clearPendingPrompt);

  // Reader scope — subscribe để button "Sách" enable/disable real-time
  const readerDoc = useReaderStore((s) => s.doc);
  const readerBookId = useReaderStore((s) => s.bookId);
  const hasReader = readerDoc !== null && readerBookId !== null;

  /**
   * Book mode = local toggle, không persist.
   * Init default = true nếu đang có reader active khi mount → user mở AI
   * modal trong reader thì mặc định vô mode "Sách" luôn (đúng intent).
   */
  const [bookMode, setBookMode] = useState(() => hasReader);

  // Auto tắt bookMode khi user đóng reader (vd navigate ra Library)
  useEffect(() => {
    if (!hasReader && bookMode) setBookMode(false);
  }, [hasReader, bookMode]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll khi messages thay đổi (kể cả streaming text)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, [messages]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    if (streaming) return;
    if (messages.length === 0) return;
    if (!window.confirm('Xóa toàn bộ lịch sử chat?')) return;
    setMessages([]);
  }, [streaming, messages.length]);

  const sendMessage = useCallback(async (override?: { text?: string; forceBookMode?: boolean }) => {
    const text = (override?.text ?? input).trim();
    if (!text || streaming) return;
    if (!isReady) {
      toast.error('RAG chưa sẵn sàng');
      return;
    }

    // Resolve effective bookMode: override > current toggle. Vẫn require hasReader.
    const effectiveBookMode = (override?.forceBookMode ?? bookMode) && hasReader;

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      text,
      sources: [],
      bookScope: null,
      badge: null,
      streaming: false,
    };

    const assistId = uid();
    const assistMsg: Message = {
      id: assistId,
      role: 'model',
      text: '',
      sources: [],
      bookScope: null,
      badge: null,
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistMsg]);
    setInput('');
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      let systemPrompt: string;
      let sources: Source[] = [];
      let bookScope: BookScope | null = null;
      let badge: Badge;

      // ----- Book mode: skip vector retrieve, dùng book-context -----
      if (effectiveBookMode && hasReader) {
        const reader = useReaderStore.getState();
        if (!reader.doc || !reader.bookId) {
          throw new Error('Reader không còn active');
        }
        const ctx = await extractBookContext(reader.doc, reader.currentPage, 10);
        const contextText = formatBookContext(ctx);
        if (!contextText.trim()) {
          throw new Error(
            'Không extract được text từ PDF (có thể sách scan ảnh thuần).',
          );
        }
        systemPrompt = promptBookContext(
          contextText,
          ctx.currentPage,
          ctx.fromPage,
          ctx.toPage,
        );
        bookScope = {
          bookId: reader.bookId,
          bookTitle: reader.bookTitle,
          currentPage: ctx.currentPage,
          fromPage: ctx.fromPage,
          toPage: ctx.toPage,
        };
        badge = 'book';
      } else {
        // ----- RAG modes: retrieve trước -----
        const retrieval = await ragRetrieve(text, { limit: 8 });
        const threshold = config.similarityThreshold;

        if (chatMode === 'internal') {
          const context = formatChunksAsContext(retrieval.rawChunks);
          systemPrompt = promptInternal(context);
          sources = buildSources(retrieval.rawChunks);
          badge = 'internal';
        } else if (
          retrieval.maxSimilarity >= threshold &&
          retrieval.rawChunks.length > 0
        ) {
          const context = formatChunksAsContext(retrieval.rawChunks);
          systemPrompt = promptAutoWithContext(context);
          sources = buildSources(retrieval.rawChunks);
          badge = 'auto_context';
        } else {
          systemPrompt = PROMPT_AUTO_NO_CONTEXT;
          badge = 'auto_pure';
        }
      }

      // Gắn badge + sources sớm (UI hiện được trước khi stream xong)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistId ? { ...m, sources, bookScope, badge } : m,
        ),
      );

      // Build history (10 message gần nhất trừ assistant placeholder)
      const history = buildHistory(messages, userMsg);

      await chatStream(
        history,
        (delta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistId ? { ...m, text: m.text + delta } : m,
            ),
          );
        },
        { systemPrompt, temperature: 0.7, signal: ctrl.signal },
      );

      // Stream xong: filter sources chỉ giữ những [n] AI thực sự cite trong answer.
      // Lý do: retrieve top-8 nhưng AI có thể chỉ dùng 1-2 source → hiển thị 15
      // nguồn rác rất khó hiểu cho user.
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistId) return m;
          const cited = extractCitedIndexes(m.text);
          const filtered =
            cited.size > 0
              ? m.sources.filter((s) => cited.has(s.index))
              : m.sources; // AI không cite gì → giữ nguyên (vd Book mode dùng [p.X])
          return { ...m, sources: filtered, streaming: false };
        }),
      );
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistId) return m;
          if (aborted) {
            return {
              ...m,
              text: m.text + (m.text ? '\n\n_(đã dừng)_' : '_(đã dừng)_'),
              streaming: false,
            };
          }
          return {
            ...m,
            text: `⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`,
            badge: null,
            sources: [],
            bookScope: null,
            streaming: false,
          };
        }),
      );
      if (!aborted) {
        toast.error('Chat lỗi', {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [
    input,
    streaming,
    isReady,
    bookMode,
    hasReader,
    chatMode,
    config.similarityThreshold,
    messages,
  ]);

  // ----- Consume pendingPrompt từ ngoài (Reader SelectionMenu "Hỏi AI") -----
  // Dùng id để re-fire nếu user click 2 lần liên tiếp cùng đoạn text.
  const lastPromptIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingPrompt) return;
    if (pendingPrompt.id === lastPromptIdRef.current) return;
    if (!isReady) return; // đợi bootstrap xong
    if (streaming) return; // đợi message hiện tại stream xong

    lastPromptIdRef.current = pendingPrompt.id;
    const { text, preferBookMode } = pendingPrompt;
    clearPendingPrompt();

    // Nếu yêu cầu book mode + reader đang active → bật toggle (UI feedback)
    if (preferBookMode && hasReader) setBookMode(true);

    void sendMessage({
      text,
      forceBookMode: preferBookMode && hasReader,
    });
  }, [pendingPrompt, isReady, streaming, hasReader, sendMessage, clearPendingPrompt]);

  // ----- Not-ready state -----
  if (status === 'needs_setup') {
    return (
      <NotReadyState
        title="Chưa setup RAG"
        message="Cần ít nhất 1 Gemini API key để dùng chat."
      />
    );
  }
  if (status !== 'ready') {
    return (
      <NotReadyState
        title="RAG chưa sẵn sàng"
        message="Đang khởi động hoặc gặp lỗi. Check Setting → group RAG."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top toolbar: segmented mode + actions */}
      <div className="flex items-center gap-2 border-b border-border bg-popover/30 px-4 py-2">
        <div className="flex">
          <ModeButton
            active={!bookMode && chatMode === 'auto'}
            icon={Globe}
            label="Auto"
            onClick={() => {
              setBookMode(false);
              setChatMode('auto');
            }}
          />
          <ModeButton
            active={!bookMode && chatMode === 'internal'}
            icon={BookOpen}
            label="Internal"
            onClick={() => {
              setBookMode(false);
              setChatMode('internal');
            }}
          />
          <ModeButton
            active={bookMode}
            icon={Book}
            label="Sách"
            onClick={() => setBookMode(true)}
            disabled={!hasReader}
            title={
              hasReader
                ? 'Hỏi nội dung sách đang đọc (trang hiện tại ± 10)'
                : 'Mở 1 cuốn sách trong Reader để dùng mode này'
            }
          />
        </div>
        <span className="ml-auto hidden truncate text-[10px] text-muted-foreground sm:inline">
          {bookMode
            ? 'Text trang đang đọc'
            : chatMode === 'auto'
              ? 'Notes + LLM tự chọn'
              : 'Chỉ từ ghi chú'}
        </span>
        <button
          type="button"
          onClick={clearMessages}
          disabled={streaming || messages.length === 0}
          title="Xóa lịch sử chat"
          className="ml-auto flex h-7 w-7 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-30 sm:ml-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyChatState bookMode={bookMode} hasReader={hasReader} />
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border bg-popover/30 px-4 py-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          placeholder={
            bookMode
              ? 'Hỏi nội dung sách đang đọc...'
              : 'Nhập câu hỏi... (Enter để gửi)'
          }
          disabled={streaming}
          className="h-9 flex-1 text-sm"
        />
        {streaming ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={stopGeneration}
            className="h-9 w-9 shrink-0 p-0"
            aria-label="Dừng"
            title="Dừng generation"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => void sendMessage()}
            disabled={!input.trim()}
            className="h-9 w-9 shrink-0 p-0"
            aria-label="Gửi"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ModeButton
// ============================================================

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  active: boolean;
  icon: typeof Globe;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center gap-1.5 border border-border px-2.5 py-1 text-[11px] font-medium transition-colors',
        '-ml-px first:ml-0', // overlap border share viền
        active
          ? 'z-10 border-primary bg-primary/10 text-primary'
          : 'bg-background text-muted-foreground hover:bg-popover hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-background hover:text-muted-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

// ============================================================
// MessageBubble
// ============================================================

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-card text-foreground',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : (
          <AssistantBody message={message} />
        )}
      </div>
    </div>
  );
}

function AssistantBody({ message }: { message: Message }) {
  const isEmpty = message.text.length === 0;

  return (
    <div className="space-y-2.5">
      {/* Body: plaintext khi streaming, markdown khi xong */}
      {isEmpty && message.streaming ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Đang nghĩ...</span>
        </div>
      ) : message.streaming ? (
        <p className="whitespace-pre-wrap">
          {message.text}
          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary/70 align-middle" />
        </p>
      ) : (
        <MarkdownAnswer
          text={message.text}
          sources={message.sources}
          bookScope={message.bookScope}
        />
      )}

      {/* Badge + source list (chỉ khi stream xong + có badge) */}
      {!message.streaming && message.badge && (
        <div className="space-y-2 border-t border-border/60 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <BadgeChip type={message.badge} />
            {message.bookScope && (
              <span className="truncate text-[10px] text-muted-foreground">
                {message.bookScope.bookTitle || 'Book'} · p.
                {message.bookScope.fromPage}–{message.bookScope.toPage}
              </span>
            )}
          </div>
          {message.sources.length > 0 && <SourceList sources={message.sources} />}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MarkdownAnswer — parse markdown + bind citation click
// ============================================================
//
// Hai loại citation:
//   - RAG: [1], [2], [1,2] → navigate tới source theo entityType
//   - Book: [p.42] → navigate tới /reader/:bookId?page=42
// ============================================================

function MarkdownAnswer({
  text,
  sources,
  bookScope,
}: {
  text: string;
  sources: Source[];
  bookScope: BookScope | null;
}) {
  const navigate = useNavigate();
  const closeModal = useModalStore((s) => s.close);

  const html = useMemo(() => {
    let raw = renderMarkdown(text);

    if (bookScope) {
      // Book mode: match [p.X], [p. X], [p.12-15] (lấy số đầu)
      raw = raw.replace(
        /\[p\.\s*(\d+)(?:\s*-\s*\d+)?\]/gi,
        (_, p1: string) =>
          `<button type="button" data-page="${p1}" class="rag-cite">[p.${p1}]</button>`,
      );
    } else if (sources.length > 0) {
      // RAG mode: match [1], [2], [1, 2], [1,2]
      raw = raw.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, group: string) => {
        const nums = group.split(',').map((s) => s.trim());
        const links = nums
          .map((n) => {
            const idx = Number(n);
            const src = sources.find((s) => s.index === idx);
            if (!src) return `[${n}]`;
            return `<button type="button" data-cite="${idx}" class="rag-cite">[${n}]</button>`;
          })
          .join('');
        return links;
      });
    }
    return raw;
  }, [text, sources, bookScope]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('button[data-cite], button[data-page]') as
        | HTMLElement
        | null;
      if (!btn) return;
      e.preventDefault();

      // Book mode citation
      if (btn.dataset.page && bookScope) {
        const page = Number(btn.dataset.page);
        if (!Number.isFinite(page)) return;
        closeModal();
        navigate(
          `/reader/read/${encodeURIComponent(bookScope.bookId)}?page=${page}`,
        );
        return;
      }

      // RAG citation
      if (btn.dataset.cite) {
        const idx = Number(btn.dataset.cite);
        const src = sources.find((s) => s.index === idx);
        if (!src) return;
        const url = buildSourceUrl(src);
        if (!url) return;
        closeModal();
        navigate(url);
      }
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [sources, bookScope, navigate, closeModal]);

  return (
    <div
      ref={containerRef}
      className="rag-md text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ============================================================
// SourceList — compact list các nguồn (click → navigate)
// ============================================================

const ENTITY_ICONS = {
  note: FileText,
  task: CheckSquare,
  highlight: Highlighter,
  book_chunk: BookOpen,
} as const;

function SourceList({ sources }: { sources: Source[] }) {
  const navigate = useNavigate();
  const closeModal = useModalStore((s) => s.close);

  function handleClick(src: Source) {
    const url = buildSourceUrl(src);
    if (!url) return;
    closeModal();
    navigate(url);
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {sources.map((s) => {
        const Icon = ENTITY_ICONS[s.entityType];
        return (
          <li key={s.index}>
            <button
              type="button"
              onClick={() => handleClick(s)}
              title={s.title}
              className="flex max-w-[200px] items-center gap-1.5 border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
            >
              <span className="font-mono text-[10px] text-primary">[{s.index}]</span>
              <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{s.title}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ============================================================
// BadgeChip
// ============================================================

function BadgeChip({ type }: { type: Badge }) {
  const map: Record<Badge, { label: string; cls: string }> = {
    internal: { label: '📚 Từ ghi chú', cls: 'border-primary/40 text-primary' },
    auto_context: { label: '📚 Kết hợp', cls: 'border-primary/40 text-primary' },
    auto_pure: {
      label: '🌐 Kiến thức chung',
      cls: 'border-border text-muted-foreground',
    },
    book: { label: '📖 Sách', cls: 'border-primary/40 text-primary' },
  };
  const { label, cls } = map[type];
  return (
    <span className={cn('border bg-background px-1.5 py-0.5 text-[10px]', cls)}>
      {label}
    </span>
  );
}

// ============================================================
// Empty / NotReady states
// ============================================================

function EmptyChatState({
  bookMode,
  hasReader,
}: {
  bookMode: boolean;
  hasReader: boolean;
}) {
  if (bookMode && hasReader) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center border border-primary/30 bg-primary/5">
          <Book className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Hỏi gì trong vùng đang đọc?
          </p>
          <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
            Kiro extract text trang hiện tại ± 10 trang, gửi Gemini. AI cite{' '}
            <code className="bg-muted px-1 py-px text-primary">[p.X]</code> — click để nhảy tới trang đó.
          </p>
        </div>
        <ExampleList
          items={[
            'tóm tắt đoạn này',
            'khái niệm X được định nghĩa thế nào?',
            'tác giả đang lập luận gì?',
          ]}
        />
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center border border-primary/30 bg-primary/5">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Hỏi gì cũng được</p>
        <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
          AI tự kết hợp notes/tasks/highlights của bạn + kiến thức chung.
          Nguồn cite dạng <code className="bg-muted px-1 py-px text-primary">[n]</code>, click để mở.
        </p>
      </div>
      <ExampleList
        items={[
          'task pending tuần này',
          'tóm tắt highlight về react',
          'ielts từ vựng đã ghi về môi trường',
        ]}
      />
    </div>
  );
}

function ExampleList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 flex flex-col gap-1 text-[11px] text-muted-foreground">
      {items.map((it) => (
        <li
          key={it}
          className="border border-border/60 bg-popover/40 px-2 py-1 font-mono"
        >
          "{it}"
        </li>
      ))}
    </ul>
  );
}

function NotReadyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center border border-border bg-muted">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>
      <a
        href="/setting"
        className="border border-primary/40 bg-primary/5 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
      >
        Mở Setting → group RAG
      </a>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Parse text answer → Set<number> các citation index AI đã thực sự dùng.
 *
 * Match `[1]`, `[2]`, `[1, 2]`, `[1,2]`. Bỏ qua `[p.X]` (Book mode).
 *
 * Lý do filter: retrieve top-8 nhưng AI có thể chỉ cite 1-2. Hiển thị
 * hết 15 nguồn dedup rất rối.
 */
function extractCitedIndexes(text: string): Set<number> {
  const out = new Set<number>();
  const re = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    for (const part of m[1].split(',')) {
      const n = Number(part.trim());
      if (Number.isFinite(n)) out.add(n);
    }
  }
  return out;
}

function buildSources(chunks: RagMatchRow[]): Source[] {
  // Dedupe theo entity (giữ chunk similarity cao nhất per entity)
  const byEntity = new Map<string, RagMatchRow>();
  for (const c of chunks) {
    const key = `${c.entity_type}:${c.entity_id}`;
    const existing = byEntity.get(key);
    if (!existing || c.similarity > existing.similarity) {
      byEntity.set(key, c);
    }
  }
  const unique = Array.from(byEntity.values()).sort(
    (a, b) => b.similarity - a.similarity,
  );
  return unique.map((c, i) => ({
    index: i + 1,
    entityType: c.entity_type,
    entityId: c.entity_id,
    title: extractTitle(c),
    metadata: c.metadata ?? {},
  }));
}

function extractTitle(c: RagMatchRow): string {
  const m = c.metadata ?? {};
  if (typeof m.title === 'string' && m.title) return m.title;
  if (typeof m.bookTitle === 'string' && m.bookTitle) {
    const page = typeof m.page === 'number' ? ` · p.${m.page}` : '';
    return m.bookTitle + page;
  }
  return c.entity_type;
}

function buildHistory(messages: Message[], userMsg: Message): GeminiMessage[] {
  // Lấy 10 message gần nhất (lọc bỏ message đang streaming/rỗng)
  const usable = messages.filter((m) => m.text.trim().length > 0);
  const recent = usable.slice(-10);
  const history: GeminiMessage[] = recent.map((m) => ({
    role: m.role,
    text: m.text,
  }));
  history.push({ role: 'user', text: userMsg.text });
  return history;
}

function buildSourceUrl(src: Source): string | null {
  switch (src.entityType) {
    case 'note': {
      // Note type 'source' đi qua route /sources; còn lại đi /notes.
      const noteType = src.metadata.type;
      if (noteType === 'source') {
        return `/sources?noteId=${encodeURIComponent(src.entityId)}`;
      }
      return `/notes?noteId=${encodeURIComponent(src.entityId)}`;
    }
    case 'task': {
      // parentId (list cha) cần thiết để Tasks route set filter đúng list.
      const parentId = src.metadata.parentId;
      const listParam =
        typeof parentId === 'string' && parentId.length > 0
          ? `&listId=${encodeURIComponent(parentId)}`
          : '';
      return `/tasks?taskId=${encodeURIComponent(src.entityId)}${listParam}`;
    }
    case 'highlight': {
      const bookId = src.metadata.bookId;
      const page = src.metadata.page;
      if (typeof bookId === 'string') {
        const pageParam = typeof page === 'number' ? `&page=${page}` : '';
        return `/reader/read/${encodeURIComponent(bookId)}?highlightId=${encodeURIComponent(src.entityId)}${pageParam}`;
      }
      return '/reader';
    }
    case 'book_chunk': {
      const bookId = src.metadata.bookId;
      const page = src.metadata.page;
      if (typeof bookId === 'string') {
        const pageParam = typeof page === 'number' ? `?page=${page}` : '';
        return `/reader/read/${encodeURIComponent(bookId)}${pageParam}`;
      }
      return '/reader';
    }
    default:
      return null;
  }
}