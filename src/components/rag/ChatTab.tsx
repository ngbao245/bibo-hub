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
  FileText,
  CheckSquare,
  Highlighter,
  X,
} from 'lucide-react';

import TextareaAutosize from 'react-textarea-autosize';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

import { useModalStore } from '@/stores/modalStore';
import { useRagStore, selectIsReady, type RagPendingContext } from '@/stores/ragStore';
import { useReaderStore } from '@/stores/readerStore';
import { ragRetrieve } from '@/lib/rag/search';
import {
  chatStream,
  getKeyPoolWaitInfo,
  type ChatMessage as GeminiMessage,
} from '@/lib/rag/gemini';
import { RagAllKeysFailedError, RagNoTokenError } from '@/lib/rag/types';
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
import {
  useCreateRagSession,
  useDeleteRagSession,
  useDeleteRagSessions,
  useRagSessions,
  useUpdateRagSession,
} from '@/api/ragSessions';
import {
  MSG_RAW_LIMIT,
  REGEN_THRESHOLD,
  SUMMARY_THRESHOLD,
  SCROLL_TOP_TRIGGER_PX,
  type RagSession,
  type SessionSummary,
  type StoredMessage,
} from '@/lib/rag/sessions';
import { generateSessionSummary, generateSessionTitle } from '@/lib/rag/summary';
import SessionBar from './SessionBar';
import SessionContextMenu from './SessionContextMenu';

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
//   - Book: [p.X] → navigate tới /library/read/:bookId?page=X
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
  const pendingContext = useRagStore((s) => s.pendingContext);
  const clearPendingContext = useRagStore((s) => s.clearPendingContext);

  // ----- Session store -----
  const activeSessionId = useRagStore((s) => s.activeSessionId);
  const setActiveSessionId = useRagStore((s) => s.setActiveSessionId);
  const draftInput = useRagStore((s) => s.draftInput);
  const setDraftInput = useRagStore((s) => s.setDraftInput);

  // ----- Session queries + mutations -----
  const sessionsQuery = useRagSessions();
  const sessions: RagSession[] = sessionsQuery.data ?? [];
  const createSessionMut = useCreateRagSession();
  const updateSessionMut = useUpdateRagSession();
  const deleteSessionMut = useDeleteRagSession();
  const deleteSessionsMut = useDeleteRagSessions();

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
  // Ref sync với messages để read latest state trong async flow (không phụ thuộc closure).
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const input = draftInput;
  const setInput = setDraftInput;
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Throttle PUT session updates (2s). Force flush khi stream done.
  const pendingPutRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; messages: Message[] | null }>({
    timer: null,
    messages: null,
  });
  // Context menu state (right-click session pill).
  const [ctxMenu, setCtxMenu] = useState<{ session: RagSession; x: number; y: number } | null>(null);
  // Track session đã gen title chưa (tránh gen 2 lần).
  const titledSessionsRef = useRef<Set<string>>(new Set());
  // Ref theo dõi id session vừa switch để load messages.
  const lastLoadedSessionIdRef = useRef<string | null>(null);
  // Guard tránh 2 background regen chạy đồng thời.
  const isRegeneratingRef = useRef<boolean>(false);
  // Ref cho backgroundRegenSummary — dùng trong sendMessage mà không tạo dep cycle.
  const backgroundRegenSummaryRef = useRef<
    ((sessionId: string, storedMessages: StoredMessage[]) => Promise<void>) | null
  >(null);

  // ----- Lazy loading UI: render N message cuối, scroll top → load thêm -----
  const [renderedCount, setRenderedCount] = useState(MSG_RAW_LIMIT);
  // Reset khi chuyển session
  useEffect(() => {
    setRenderedCount(MSG_RAW_LIMIT);
  }, [activeSessionId]);
  // Scroll top → load thêm 10 msg cũ
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      if (
        el.scrollTop < SCROLL_TOP_TRIGGER_PX &&
        renderedCount < messages.length
      ) {
        const oldScrollHeight = el.scrollHeight;
        setRenderedCount((c) => Math.min(c + MSG_RAW_LIMIT, messages.length));
        // Giữ scroll position sau khi render thêm
        requestAnimationFrame(() => {
          const newScrollHeight = el.scrollHeight;
          el.scrollTop = newScrollHeight - oldScrollHeight;
        });
      }
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [renderedCount, messages.length]);

  // Auto-scroll khi messages thay đổi (kể cả streaming text)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, [messages]);

  // ----- Load messages khi activeSessionId thay đổi (chuyển session / init từ LS) -----
  useEffect(() => {
    if (streaming) return;
    if (activeSessionId === null) {
      if (lastLoadedSessionIdRef.current !== null) {
        // Vừa clear active → reset messages
        setMessages([]);
        lastLoadedSessionIdRef.current = null;
      }
      return;
    }
    if (activeSessionId === lastLoadedSessionIdRef.current) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session) {
      // Session ID trong LS không tồn tại (bị xoá tab khác) → clear
      if (sessionsQuery.isSuccess) {
        setActiveSessionId(null);
        setMessages([]);
        lastLoadedSessionIdRef.current = null;
      }
      return;
    }
    setMessages(session.messages.map(storedToMessage));
    lastLoadedSessionIdRef.current = activeSessionId;
    // Reset title tracker cho session này để không auto re-gen title
    if (session.title) titledSessionsRef.current.add(session.id);
  }, [activeSessionId, sessions, sessionsQuery.isSuccess, streaming, setActiveSessionId]);

  // Cleanup pending PUT timer khi unmount
  useEffect(() => {
    return () => {
      const p = pendingPutRef.current;
      if (p.timer) clearTimeout(p.timer);
    };
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);



  const sendMessage = useCallback(async (override?: { text?: string; forceBookMode?: boolean }) => {
    const text = (override?.text ?? input).trim();
    if (!text || streaming) return;
    if (!isReady) {
      toast.error('RAG chưa sẵn sàng');
      return;
    }

    // Resolve effective bookMode: override > current toggle. Vẫn require hasReader.
    const effectiveBookMode = (override?.forceBookMode ?? bookMode) && hasReader;

    // ----- Session: tạo session mới nếu chưa có active -----
    let currentSessionId = activeSessionId;
    if (currentSessionId === null) {
      try {
        const reader = useReaderStore.getState();
        const created = await createSessionMut.mutateAsync({
          title: '',
          messages: [],
          chatMode: effectiveBookMode ? 'book' : chatMode,
          bookId: effectiveBookMode && reader.bookId ? reader.bookId : '',
          bookTitle: effectiveBookMode ? reader.bookTitle : '',
          updatedAt: new Date().toISOString(),
          messageCount: 0,
          pinned: false,
          summary: null,
        });
        currentSessionId = created.id;
        setActiveSessionId(created.id);
        lastLoadedSessionIdRef.current = created.id;
      } catch (err) {
        toast.error('Không tạo được session', {
          description: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }

    // ----- Summary injection: đọc từ session.summary (persist MockAPI) -----
    // Session ≤ SUMMARY_THRESHOLD msg → không dùng summary, gửi raw.
    // Session > threshold + có summary → prepend text, gửi messages sau upToIndex.
    // Session > threshold + chưa summary → gửi raw 10 msg cuối, trigger background gen.
    let summaryPrefix = '';
    const currentSession = sessions.find((s) => s.id === currentSessionId);
    const existingSummary = currentSession?.summary ?? null;
    const totalMsgBeforeUser = messages.length;
    if (
      totalMsgBeforeUser + 1 > SUMMARY_THRESHOLD &&
      existingSummary &&
      totalMsgBeforeUser > existingSummary.upToIndex + 1
    ) {
      summaryPrefix = `\n\n[Tóm tắt phần chat trước]\n${existingSummary.text}\n\n[Yêu cầu hiện tại]\n`;
    }

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
        systemPrompt = summaryPrefix + promptBookContext(
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
          systemPrompt = summaryPrefix + promptInternal(context);
          sources = buildSources(retrieval.rawChunks);
          badge = 'internal';
        } else if (
          retrieval.maxSimilarity >= threshold &&
          retrieval.rawChunks.length > 0
        ) {
          const context = formatChunksAsContext(retrieval.rawChunks);
          systemPrompt = summaryPrefix + promptAutoWithContext(context);
          sources = buildSources(retrieval.rawChunks);
          badge = 'auto_context';
        } else {
          systemPrompt = summaryPrefix + PROMPT_AUTO_NO_CONTEXT;
          badge = 'auto_pure';
        }
      }

      // Gắn badge + sources sớm (UI hiện được trước khi stream xong)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistId ? { ...m, sources, bookScope, badge } : m,
        ),
      );

      // Build history: nếu có summary, chỉ lấy messages sau upToIndex.
      // Sau đó buildHistory cap thêm 10 msg cuối (không đổi).
      const historySource = existingSummary && summaryPrefix
        ? messages.slice(existingSummary.upToIndex + 1)
        : messages;
      const history = buildHistory(historySource, userMsg);

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
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistId) return m;
          const cited = extractCitedIndexes(m.text);
          const filtered =
            cited.size > 0
              ? m.sources.filter((s) => cited.has(s.index))
              : m.sources;
          return { ...m, sources: filtered, streaming: false };
        }),
      );

      // ----- Session: PUT flush ngay (không đợi throttle) -----
      // Đọc từ ref (đã sync với state qua useEffect) để lấy messages ĐẦY ĐỦ
      // sau khi stream + filter. Capture closure không reliable trong React 18 concurrent.
      if (currentSessionId) {
        // Đợi 1 tick để useEffect flush ref sau setMessages
        await new Promise((r) => setTimeout(r, 0));
        const finalMessages = messagesRef.current;

        flushSessionUpdate(currentSessionId, finalMessages);

        // ----- Trigger background regen summary nếu cần -----
        const totalAfter = finalMessages.length;
        const currentSummary = sessions.find((s) => s.id === currentSessionId)?.summary ?? null;
        const uncovered = currentSummary
          ? totalAfter - 1 - currentSummary.upToIndex
          : totalAfter;
        if (
          totalAfter > SUMMARY_THRESHOLD &&
          uncovered >= REGEN_THRESHOLD &&
          !isRegeneratingRef.current &&
          backgroundRegenSummaryRef.current
        ) {
          isRegeneratingRef.current = true;
          const storedFinal = finalMessages
            .filter((m) => m.text.trim().length > 0)
            .map(messageToStored);
          void backgroundRegenSummaryRef.current(currentSessionId, storedFinal).finally(() => {
            isRegeneratingRef.current = false;
          });
        }

        // Gen title nếu session chưa có title (message đầu tiên)
        if (!titledSessionsRef.current.has(currentSessionId)) {
          titledSessionsRef.current.add(currentSessionId);
          const firstUser = finalMessages.find((m) => m.role === 'user');
          const firstAssist = finalMessages.find(
            (m) => m.role === 'model' && m.text.trim().length > 0,
          );
          if (firstUser && firstAssist) {
            void generateSessionTitle(firstUser.text, firstAssist.text).then((title) => {
              if (title) {
                updateSessionMut.mutate({ id: currentSessionId, patch: { title } });
              }
            });
          }
        }
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      const friendlyMsg = buildFriendlyErrorMessage(err);
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
            text: friendlyMsg,
            badge: null,
            sources: [],
            bookScope: null,
            streaming: false,
          };
        }),
      );
      // Chỉ toast cho lỗi bất ngờ. 429/no-key đã hiện friendly message trong
      // bubble, không cần toast lặp.
      const isKnownRagError =
        err instanceof RagAllKeysFailedError || err instanceof RagNoTokenError;
      if (!aborted && !isKnownRagError) {
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
    activeSessionId,
    sessions,
    createSessionMut,
    setActiveSessionId,
    updateSessionMut,
  ]);

  // ----- Throttled PUT session (batch messages) -----
  const flushSessionUpdate = useCallback(
    (sessionId: string, currentMessages: Message[]) => {
      const p = pendingPutRef.current;
      if (p.timer) {
        clearTimeout(p.timer);
        p.timer = null;
      }
      const storedMessages = currentMessages
        .filter((m) => m.text.trim().length > 0)
        .map(messageToStored);
      updateSessionMut.mutate({
        id: sessionId,
        patch: {
          messages: storedMessages,
          messageCount: storedMessages.length,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [updateSessionMut],
  );

  // ----- Background regen summary (không block user) -----
  const backgroundRegenSummary = useCallback(
    async (sessionId: string, storedMessages: StoredMessage[]) => {
      // Bỏ 2 messages cuối để giữ context recent cho payload chính
      const toSummarize = storedMessages.slice(0, -2);
      if (toSummarize.length === 0) return;
      try {
        const text = await generateSessionSummary(toSummarize);
        if (!text) return;
        const truncated = text.length > 5000 ? text.slice(0, 5000) : text;
        const summary: SessionSummary = {
          text: truncated,
          upToIndex: toSummarize.length - 1,
        };
        updateSessionMut.mutate({
          id: sessionId,
          patch: { summary },
        });
      } catch {
        // Silent fail, giữ summary cũ
      }
    },
    [updateSessionMut],
  );

  // Sync ref để sendMessage dùng được (avoid circular dep + TDZ).
  useEffect(() => {
    backgroundRegenSummaryRef.current = backgroundRegenSummary;
  }, [backgroundRegenSummary]);

  // ----- Consume pendingContext từ ngoài (Reader SelectionMenu "AI Assistant") -----
  // Khi context arrive:
  //   1. Bật Book mode toggle (feedback UI)
  //   2. Auto match session gần nhất cùng bookId (thay vì append vào session active bất kỳ)
  //   User quyết action qua QuickActions row hoặc gõ input, KHÔNG auto-send.
  const lastContextIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingContext) return;
    if (pendingContext.id === lastContextIdRef.current) return;
    lastContextIdRef.current = pendingContext.id;
    if (!hasReader) return;
    setBookMode(true);

    const reader = useReaderStore.getState();
    if (!reader.bookId) return;

    // Nếu active session đã cùng bookId → giữ nguyên
    if (activeSessionId) {
      const active = sessions.find((s) => s.id === activeSessionId);
      if (active && active.bookId === reader.bookId) return;
    }

    // Tìm session gần nhất cùng bookId (cả pin lẫn thường)
    const matched = sessions
      .filter((s) => s.bookId === reader.bookId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

    if (matched) {
      setActiveSessionId(matched.id);
    } else {
      // Không có session cùng bookId → clear active, sẽ tạo mới khi Send
      setActiveSessionId(null);
    }
  }, [pendingContext, hasReader, sessions, activeSessionId, setActiveSessionId]);

  // ----- Quick action handlers (build prompt từ template + send + clear context) -----
  const handleQuickAction = useCallback(
    (type: 'explain' | 'summarize') => {
      if (!pendingContext || streaming) return;
      const { text: quote, page } = pendingContext;
      const prompt =
        type === 'explain'
          ? `Giải thích đoạn sau (trích trang ${page}) theo ngữ cảnh:\n\n> ${quote}`
          : `Tóm tắt ý chính của đoạn sau (trích trang ${page}):\n\n> ${quote}`;
      clearPendingContext();
      void sendMessage({ text: prompt, forceBookMode: hasReader });
    },
    [pendingContext, streaming, hasReader, sendMessage, clearPendingContext],
  );

  // Send custom input: nếu có pendingContext, attach quote vào cuối.
  const handleSendInput = useCallback(() => {
    if (!input.trim() || streaming) return;
    if (pendingContext) {
      const { text: quote, page } = pendingContext;
      const composed = `${input.trim()}\n\n> (Trang ${page}: ${quote})`;
      clearPendingContext();
      void sendMessage({ text: composed, forceBookMode: hasReader });
    } else {
      void sendMessage();
    }
  }, [input, streaming, pendingContext, hasReader, sendMessage, clearPendingContext]);

  // ----- Session actions -----
  const handleSelectSession = useCallback(
    (id: string) => {
      if (streaming) return;
      setActiveSessionId(id);
    },
    [streaming, setActiveSessionId],
  );

  const handleSessionContextMenu = useCallback((session: RagSession, evt: React.MouseEvent) => {
    setCtxMenu({ session, x: evt.clientX, y: evt.clientY });
  }, []);

  const handleRenameSession = useCallback(
    (session: RagSession) => {
      const next = window.prompt('Đổi tên session:', session.title || '');
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed) return;
      updateSessionMut.mutate({ id: session.id, patch: { title: trimmed } });
      titledSessionsRef.current.add(session.id);
    },
    [updateSessionMut],
  );

  const handlePinToggle = useCallback(
    (session: RagSession) => {
      updateSessionMut.mutate({ id: session.id, patch: { pinned: !session.pinned } });
    },
    [updateSessionMut],
  );

  const pickNextActiveAfterDelete = useCallback(
    (deletedIds: Set<string>): string | null => {
      const remaining = sessions.filter((s) => !deletedIds.has(s.id));
      if (remaining.length === 0) return null;
      const pin = remaining.find((s) => s.pinned);
      if (pin) return pin.id;
      return remaining[0].id;
    },
    [sessions],
  );

  const handleCloseSession = useCallback(
    (session: RagSession) => {
      if (!window.confirm(`Xoá session "${session.title || 'New session'}"?`)) return;
      deleteSessionMut.mutate(session.id, {
        onSuccess: () => {
          titledSessionsRef.current.delete(session.id);
          if (activeSessionId === session.id) {
            const next = pickNextActiveAfterDelete(new Set([session.id]));
            setActiveSessionId(next);
          }
        },
      });
    },
    [activeSessionId, deleteSessionMut, pickNextActiveAfterDelete, setActiveSessionId],
  );

  const handleCloseOthers = useCallback(
    (session: RagSession) => {
      const targets = sessions.filter((s) => s.id !== session.id && !s.pinned);
      if (targets.length === 0) return;
      if (!window.confirm(`Xoá ${targets.length} session khác (giữ pin + session hiện tại)?`)) return;
      const ids = targets.map((s) => s.id);
      deleteSessionsMut.mutate(ids, {
        onSuccess: () => {
          ids.forEach((id) => {
            titledSessionsRef.current.delete(id);
          });
          setActiveSessionId(session.id);
        },
      });
    },
    [sessions, deleteSessionsMut, setActiveSessionId],
  );

  const handleCloseAll = useCallback(
    (session: RagSession) => {
      const targets = sessions.filter((s) => !s.pinned);
      if (targets.length === 0) return;
      if (!window.confirm(`Xoá ${targets.length} session (giữ tất cả pin)?`)) return;
      const ids = targets.map((s) => s.id);
      const idSet = new Set(ids);
      deleteSessionsMut.mutate(ids, {
        onSuccess: () => {
          ids.forEach((id) => {
            titledSessionsRef.current.delete(id);
          });
          if (activeSessionId && idSet.has(activeSessionId)) {
            const next = pickNextActiveAfterDelete(idSet);
            setActiveSessionId(next);
          } else if (activeSessionId === session.id && !session.pinned) {
            // session chuột phải chính là không pin → cũng bị xoá
            const next = pickNextActiveAfterDelete(idSet);
            setActiveSessionId(next);
          }
        },
      });
    },
    [
      sessions,
      deleteSessionsMut,
      activeSessionId,
      pickNextActiveAfterDelete,
      setActiveSessionId,
    ],
  );

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

  const activeSession = activeSessionId
    ? sessions.find((s) => s.id === activeSessionId) ?? null
    : null;
  const showBookBadge =
    activeSession !== null &&
    activeSession.chatMode === 'book' &&
    activeSession.bookTitle.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Session bar (ẩn nếu 0 sessions) */}
      <SessionBar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={handleSelectSession}
        onContextMenu={handleSessionContextMenu}
        onNewChat={() => setActiveSessionId(null)}
        onClose={handleCloseSession}
      />

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

        {/* Book badge (session mode=book) — thay hint text cũ */}
        {showBookBadge && activeSession && (
          <span className="ml-2 inline-flex items-center gap-1 truncate border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
            <BookOpen className="h-3 w-3" />
            <span className="max-w-[140px] truncate">{activeSession.bookTitle}</span>
          </span>
        )}

      </div>

      {/* Messages — lazy render {renderedCount} message cuối, scroll top load thêm */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          pendingContext ? null : (
            <EmptyChatState bookMode={bookMode} hasReader={hasReader} />
          )
        ) : (
          <div className="space-y-4">
            {renderedCount < messages.length && (
              <div className="py-2 text-center text-[10px] text-muted-foreground">
                Cuộn lên để xem message cũ hơn ({messages.length - renderedCount} còn lại)
              </div>
            )}
            {messages.slice(-renderedCount).map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* Context card + quick actions (Reader → AI Assistant flow) */}
      {pendingContext && (
        <ReaderContextPanel
          context={pendingContext}
          onClear={clearPendingContext}
          onQuickAction={handleQuickAction}
          disabled={streaming}
        />
      )}

      {/* Session context menu (right-click) */}
      {ctxMenu && (
        <SessionContextMenu
          session={ctxMenu.session}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onRename={() => handleRenameSession(ctxMenu.session)}
          onPinToggle={() => handlePinToggle(ctxMenu.session)}
          onClose={() => handleCloseSession(ctxMenu.session)}
          onCloseOthers={() => handleCloseOthers(ctxMenu.session)}
          onCloseAll={() => handleCloseAll(ctxMenu.session)}
          onDismiss={() => setCtxMenu(null)}
        />
      )}

      {/* Input — multiline, Shift+Enter xuống dòng, Enter gửi */}
      <div className="flex items-end gap-2 border-t border-border bg-popover/30 px-4 py-3">
        <TextareaAutosize
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendInput();
            }
          }}
          placeholder={
            pendingContext
              ? 'Hoặc gõ yêu cầu khác về đoạn này...'
              : bookMode
                ? 'Hỏi nội dung sách đang đọc... (Shift+Enter để xuống dòng)'
                : 'Nhập câu hỏi... (Enter gửi, Shift+Enter xuống dòng)'
          }
          disabled={streaming}
          minRows={1}
          maxRows={6}
          className="flex w-full min-h-9 flex-1 resize-none border border-input bg-background px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
            onClick={handleSendInput}
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
//   - Book: [p.42] → navigate tới /library/read/:bookId?page=42
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
          `/library/read/${encodeURIComponent(bookScope.bookId)}?page=${page}`,
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
        href="/config"
        className="border border-primary/40 bg-primary/5 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
      >
        Mở Config → AI Agentic
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
        return `/library/read/${encodeURIComponent(bookId)}?highlightId=${encodeURIComponent(src.entityId)}${pageParam}`;
      }
      return '/library';
    }
    case 'book_chunk': {
      const bookId = src.metadata.bookId;
      const page = src.metadata.page;
      if (typeof bookId === 'string') {
        const pageParam = typeof page === 'number' ? `?page=${page}` : '';
        return `/library/read/${encodeURIComponent(bookId)}${pageParam}`;
      }
      return '/library';
    }
    default:
      return null;
  }
}

// ============================================================
// ReaderContextPanel — hiển thị quote từ Reader + 2 quick action
// ============================================================
//
// Render khi ragStore.pendingContext !== null. User có 3 option:
//   1. Click "Giải thích" → prompt template giải thích + send
//   2. Click "Tóm tắt" → prompt template tóm tắt + send
//   3. Click × → clear context, không send
//   4. Gõ input rồi Send → context auto-attach vào cuối message
// ============================================================

function ReaderContextPanel({
  context,
  onClear,
  onQuickAction,
  disabled,
}: {
  context: RagPendingContext;
  onClear: () => void;
  onQuickAction: (type: 'explain' | 'summarize') => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2 border-t border-border bg-popover/50 px-4 py-3">
      {/* Quote card */}
      <div className="flex items-start gap-2 border border-border bg-background/60 px-3 py-2">
        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-primary/80">
            Trang {context.page}
          </div>
          <p className="line-clamp-3 text-xs italic leading-relaxed text-muted-foreground">
            "{context.text}"
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          title="Bỏ context"
          className="shrink-0 border border-transparent p-0.5 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quick actions + New chat override */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Nhanh:</span>
        <button
          type="button"
          onClick={() => onQuickAction('explain')}
          disabled={disabled}
          className="flex items-center gap-1 border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:opacity-40"
        >
          <Sparkles className="h-3 w-3" />
          Giải thích
        </button>
        <button
          type="button"
          onClick={() => onQuickAction('summarize')}
          disabled={disabled}
          className="flex items-center gap-1 border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:opacity-40"
        >
          <FileText className="h-3 w-3" />
          Tóm tắt
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Serialize helpers cho session persistence
// ============================================================

function messageToStored(m: Message): StoredMessage {
  return {
    id: m.id,
    role: m.role,
    text: m.text,
    sources: m.sources.map((s) => ({
      index: s.index,
      entityType: s.entityType,
      entityId: s.entityId,
      title: s.title,
      metadata: s.metadata,
    })),
    badge: m.badge,
    bookScope: m.bookScope,
    ts: new Date().toISOString(),
  };
}

function storedToMessage(s: StoredMessage): Message {
  return {
    id: s.id,
    role: s.role,
    text: s.text,
    sources: s.sources.map((src) => ({
      index: src.index,
      entityType: src.entityType,
      entityId: src.entityId,
      title: src.title,
      metadata: src.metadata,
    })),
    badge: s.badge as Badge | null,
    bookScope: s.bookScope,
    streaming: false,
  };
}

// ============================================================
// Friendly error message — khi Gemini pool exhausted / no key
// ============================================================

function buildFriendlyErrorMessage(err: unknown): string {
  if (err instanceof RagNoTokenError) {
    return '⚠ Chưa có Gemini API key. Mở Setting → RAG để thêm key.';
  }
  if (err instanceof RagAllKeysFailedError) {
    const info = getKeyPoolWaitInfo();
    if (info?.type === 'rpm') {
      const seconds = Math.max(1, Math.ceil(info.waitMs / 1000));
      return `⚠ Đã hết lượt hỏi tạm thời. Thử lại sau ${seconds} giây.`;
    }
    if (info?.type === 'rpd') {
      const d = new Date(info.resetAt);
      const timeStr = d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const dayLabel =
        d.toDateString() === new Date().toDateString() ? 'hôm nay' : 'ngày mai';
      return `⚠ Đã hết quota Gemini ${dayLabel}. Reset lúc ${timeStr} ${dayLabel}. Thêm key mới trong Setting → RAG để tăng quota.`;
    }
    if (info?.type === 'invalid') {
      return '⚠ Tất cả Gemini key đều invalid. Mở Setting → RAG để cập nhật key mới.';
    }
    return '⚠ Đã hết lượt hỏi. Thử lại sau.';
  }
  const msg = err instanceof Error ? err.message : String(err);
  return `⚠ Lỗi: ${msg}`;
}