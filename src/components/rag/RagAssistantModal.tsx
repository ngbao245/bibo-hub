import { useEffect, useState } from 'react';
import {
  Search,
  MessageSquare,
  Sparkles,
  HelpCircle,
  Loader2,
  BookOpen,
  Link2,
  Database,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useModalStore } from '@/stores/modalStore';
import { useRagStore } from '@/stores/ragStore';
import { cn } from '@/lib/cn';

import { subscribeQueue, type QueueSnapshot } from '@/lib/rag/embed-queue';
import { runLazyFixupNotes } from '@/lib/rag/backfill';
import SearchTab from './SearchTab';
import ChatTab from './ChatTab';

/** Số note gần nhất cần scan khi mở RAG modal (lazy fixup tầng 2). */
const LAZY_FIXUP_MODAL_LIMIT = 10;

/**
 * Cooldown giữa 2 lần scan tầng 2 (ms).
 *
 * Tránh spam scan khi user mở/đóng modal liên tục. 5 phút là đủ dài để
 * cover pattern "mở nhiều lần trong 1 session làm việc" mà vẫn kịp sync
 * khi user rời máy rồi quay lại sau tea break.
 */
const LAZY_FIXUP_COOLDOWN_MS = 5 * 60_000;

/** Timestamp lần cuối chạy lazy fixup tầng 2 — module-scope, sống theo tab. */
let lastFixupAt = 0;

// ============================================================
// RagAssistantModal — modal chính cho RAG (Search + Chat)
// ============================================================
//
// Layout 3 tầng (top → bottom):
//   1. Header  — title + tabs gộp chung 1 hàng compact, có padding.
//   2. Body    — tab content (Search hoặc Chat), full height flex.
//   3. Footer  — queue status indicator (chỉ hiện khi có job pending).
//
// Modal size: max-w-3xl + height min(85vh, 720px) — đủ chỗ cho conv dài.
// Bỏ DialogHeader mặc định vì muốn title gộp cùng tabs để tiết kiệm space.
// ============================================================

type Tab = 'search' | 'chat';

export default function RagAssistantModal() {
  const [tab, setTab] = useState<Tab>('chat');
  const [helpOpen, setHelpOpen] = useState(false);
  const isOpen = useModalStore((s) => s.current === 'rag');
  const close = useModalStore((s) => s.close);

  // Reset help panel khi đóng modal
  useEffect(() => {
    if (!isOpen) setHelpOpen(false);
  }, [isOpen]);

  // Lazy fixup tầng 2: khi modal mở, scan 10 note gần nhất → note nào miss
  // embedding thì enqueue. Không block UI, log ra console để user biết
  // note nào đang được index (thay vì toast chung chung).
  // Cooldown 5 phút giữa các lần scan để tránh spam khi mở/đóng liên tục.
  useEffect(() => {
    if (!isOpen) return;
    if (useRagStore.getState().status !== 'ready') return;
    if (Date.now() - lastFixupAt < LAZY_FIXUP_COOLDOWN_MS) return;
    lastFixupAt = Date.now();

    let cancelled = false;
    (async () => {
      try {
        await runLazyFixupNotes({ limit: LAZY_FIXUP_MODAL_LIMIT, verbose: true });
        if (cancelled) return;
      } catch {
        // silent — user không cần biết fixup fail
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="flex h-[min(85vh,720px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:p-0"
        // Tắt close button mặc định của shadcn vì Kiro tự render close compact ở header
      >
        {/* Hidden cho a11y — Radix bắt buộc có Title/Description */}
        <DialogTitle className="sr-only">AI Assistant</DialogTitle>
        <DialogDescription className="sr-only">
          Semantic search và AI chat trên kho ghi chú cá nhân
        </DialogDescription>

        {/* Header: title + tabs + help toggle */}
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold tracking-tight">AI Assistant</span>
          <div className="ml-2 flex">
            <TabButton
              active={tab === 'chat'}
              icon={MessageSquare}
              label="Chat"
              onClick={() => setTab('chat')}
            />
            <TabButton
              active={tab === 'search'}
              icon={Search}
              label="Search"
              onClick={() => setTab('search')}
            />
          </div>
          {/* Help toggle — đặt bên trái close X của shadcn Dialog (right-4).
              Dịch thêm mr-6 để không đè lên close. */}
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            title={helpOpen ? 'Đóng hướng dẫn' : 'Xem hướng dẫn sử dụng'}
            className={cn(
              'ml-auto mr-6 flex h-7 w-7 items-center justify-center border transition-colors',
              helpOpen
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {tab === 'chat' ? <ChatTab /> : <SearchTab />}
          {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
        </div>

        {/* Footer: queue status (auto-hide khi rỗng) */}
        <QueueStatus />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TabButton — segmented control style, sát nhau, share viền
// ============================================================

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Search;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border border-border px-3 py-1 text-xs font-medium transition-colors',
        '-ml-px first:ml-0', // overlap border để 2 button share 1 viền
        active
          ? 'z-10 border-primary bg-primary/10 text-primary'
          : 'bg-background text-muted-foreground hover:bg-popover hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ============================================================
// QueueStatus — footer indicator với progress bar
// ============================================================
//
// Track peakTotal (max của pending + running trong burst hiện tại) để
// tính progress %. Reset về 0 khi queue empty. Không dùng useRef vì
// state cần render lại UI khi peakTotal đổi.
// ============================================================

function QueueStatus() {
  const [queue, setQueue] = useState<QueueSnapshot>({ pending: 0, running: 0 });
  const [peakTotal, setPeakTotal] = useState(0);

  useEffect(
    () =>
      subscribeQueue((snap) => {
        setQueue(snap);
        const total = snap.pending + snap.running;
        setPeakTotal((prev) => {
          if (total === 0) return 0;      // reset khi burst xong
          return Math.max(prev, total);   // tăng khi có job mới
        });
      }),
    [],
  );

  const total = queue.pending + queue.running;
  if (total === 0) return null;

  const done = Math.max(0, peakTotal - total);
  const percent = peakTotal > 0 ? Math.round((done / peakTotal) * 100) : 0;

  return (
    <footer className="border-t border-border bg-popover/50 px-4 py-2">
      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        <span className="flex-1">
          Đang index vào AI database...{' '}
          <strong className="text-foreground">
            {done}/{peakTotal}
          </strong>{' '}
          note xong
        </span>
        <span className="font-mono tabular-nums text-foreground">{percent}%</span>
      </div>
      <div className="h-1 w-full bg-border">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </footer>
  );
}

// ============================================================
// HelpOverlay — panel hướng dẫn cho casual user
// ============================================================

function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-10 overflow-y-auto bg-background/95 px-6 py-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto max-w-xl space-y-4 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">Hướng dẫn nhanh</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Đóng
          </button>
        </div>

        <HelpSection icon={MessageSquare} title="Tab Chat — 3 modes">
          <p>Hỏi AI câu tự nhiên, AI trả lời + cite nguồn từ kho cá nhân.</p>
          <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
            <li>
              <strong className="text-foreground">Auto</strong> (mặc định):
              AI tự chọn — có ghi chú liên quan thì cite, không có thì trả
              lời bằng kiến thức chung. Badge:{' '}
              <span className="text-primary">Từ ghi chú</span> /{' '}
              <span className="text-primary">Kết hợp</span> /{' '}
              <span className="text-muted-foreground">Kiến thức chung</span>.
            </li>
            <li>
              <strong className="text-foreground">Internal</strong>: chỉ trả
              lời dựa vào ghi chú, không có thì nói "không tìm thấy".
            </li>
            <li>
              <strong className="text-foreground">Sách</strong>: chỉ enable
              khi đang đọc PDF. Extract text trang hiện tại ± 10, hỏi về
              nội dung sách. Cite dạng{' '}
              <code className="bg-muted px-1 text-primary">[p.42]</code>{' '}
              → click nhảy tới trang.
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Mở modal khi đang đọc PDF → tự động vô mode Sách.
          </p>
        </HelpSection>

        <HelpSection icon={Search} title="Tab Search">
          <p>Semantic search — tìm note/task/highlight theo ý nghĩa, không cần khớp chính xác từ khóa.</p>
          <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
            <li>Vd "task pending gấp" → tự lọc task chưa xong + priority cao.</li>
            <li>Vd "việc dang dở" → hiểu = "pending" nhờ đồng nghĩa.</li>
            <li>Filter chips lọc theo loại: All / Notes / Tasks / Highlights.</li>
          </ul>
        </HelpSection>

        <HelpSection icon={Link2} title="Citation click được">
          <p>
            Số <code className="bg-muted px-1 text-primary">[1]</code>{' '}
            <code className="bg-muted px-1 text-primary">[2]</code> trong câu
            trả lời là <strong>nguồn</strong>. Click để mở note/task/highlight
            gốc — modal tự đóng, navigate đúng route.
          </p>
          <p className="text-xs text-muted-foreground">
            Trong mode Sách,{' '}
            <code className="bg-muted px-1 text-primary">[p.42]</code> nhảy
            thẳng tới trang trong PDF đang đọc.
          </p>
        </HelpSection>

        <HelpSection icon={BookOpen} title="Hỏi AI từ trong sách">
          <p>
            Đang đọc PDF, bôi đen 1 đoạn text → menu popup → bấm{' '}
            <strong className="text-foreground">Hỏi AI</strong>. Modal tự mở
            ở mode Sách, tự paste đoạn text vào câu hỏi và gửi ngay.
          </p>
        </HelpSection>

        <HelpSection icon={Database} title="Data nào được index">
          <p>
            AI chỉ trả lời được về data đã{' '}
            <strong className="text-foreground">index vào vector DB</strong>.
            Mở Setting → nhóm <code className="bg-muted px-1">RAG</code> →
            record <code className="bg-muted px-1">Config</code> để chọn:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
            <li>Note types nào embed (default: note, ielts, course, code).</li>
            <li>Có index tasks / highlights không.</li>
            <li>Filter độ dài: bật/tắt, ngưỡng ký tự, apply cho type nào.</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Note <code className="bg-muted px-1 text-destructive">secret</code>{' '}
            luôn bị loại trừ (hard filter). Content rỗng / chỉ ký tự đặc biệt
            (không có chữ cái) cũng bị skip tự động.
          </p>
        </HelpSection>

        <HelpSection icon={RefreshCw} title="Khi nào note được index">
          <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
            <li>
              <strong className="text-foreground">Save note</strong> (Ctrl+S /
              bấm Lưu / auto-save Source) → index background ngay.
            </li>
            <li>
              <strong className="text-foreground">App khởi động</strong> →
              sau 5s scan toàn bộ notes, index cái nào thiếu / bị sửa mà chưa
              re-embed.
            </li>
            <li>
              <strong className="text-foreground">Mở modal AI</strong> →
              scan 10 note gần nhất, index cái nào miss.
              <em className="ml-1">
                Cooldown 5 phút giữa 2 lần scan để tránh spam.
              </em>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Progress bar dưới đáy modal cho thấy số note đang được index. Serial
            queue (1 job / lần), delay 4.5s giữa jobs → mỗi note tốn ~5s.
          </p>
        </HelpSection>

        <HelpSection icon={AlertTriangle} title="Khi bị lỗi">
          <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
            <li>
              <strong className="text-foreground">"Chưa setup RAG"</strong>:
              mở Setting → nhóm RAG → record SettingInfor → nhập Gemini API
              key (ít nhất 1 trong 3 slot). Lấy key ở{' '}
              <code className="bg-muted px-1">aistudio.google.com/apikey</code>.
            </li>
            <li>
              <strong className="text-foreground">AI trả lời chậm / drop job</strong>:
              đang hit rate limit Gemini (15 RPM / 1500 RPD). Thêm 2-3 key từ
              3 Google account riêng → pool tự rotate → total 4,500 RPD.
              Fallback Groq nếu tất cả Gemini exhausted.
            </li>
            <li>
              <strong className="text-foreground">Search không thấy note mới</strong>:
              đợi progress bar chạy xong. Hoặc mở record Config →
              bấm <strong>Backfill</strong> để force scan lại toàn bộ.
            </li>
            <li>
              <strong className="text-foreground">Note bị "stale"</strong>: đã
              sửa nhưng RAG chưa cập nhật → mở modal lại sau 5 phút (qua
              cooldown) hoặc reload page để trigger scan.
            </li>
          </ul>
        </HelpSection>
      </div>
    </div>
  );
}

function HelpSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Search;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {title}
      </h3>
      <div className="space-y-1.5 border-l-2 border-primary/40 pl-3 leading-relaxed">
        {children}
      </div>
    </section>
  );
}