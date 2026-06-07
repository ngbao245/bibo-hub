import { useEffect, useRef, useState } from 'react';
import { Keyboard, ChevronDown, Pin, PinOff } from 'lucide-react';

import { TOOLS, type Tool, type ToolGroup, groupTools } from '@/lib/tools';
import { useToolAction } from '@/hooks/useToolAction';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/cn';
import FocusLayer from '@/components/FocusLayer';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToolIcon } from '@/components/ToolIcon';
import { toast } from '@/components/ui/sonner';

// ============================================================
// HubPro - bản REDESIGNED dùng shadcn/ui
// ============================================================
//
// Layout:
//   Header → Focus Layer → Favorites (full viewport đầu) → Categories → Footer
//
// Favorites: shortcut nhanh, chiếm trọn 100vh đầu tiên (trừ header/focus).
// Categories: hiển thị TẤT CẢ tools sắp theo group, scroll xuống sẽ thấy.
// 1 tool có thể xuất hiện ở cả 2 chỗ — favorite chỉ là shortcut.
// Tối đa 24 favorite slots.
// ============================================================

const GROUP_ORDER: ToolGroup[] = [
  'Productivity',
  'Finance',
  'Tracking',
  'Utilities',
  'Developer',
];

const MAX_FAVORITES = 24;

export default function HubPro() {
  const handleClick = useToolAction();
  const [focusVisible, setFocusVisible] = useLocalStorage('hubpro_focusVisible', true);
  const [favoriteIds, setFavoriteIds] = useLocalStorage<string[]>(
    'hubpro_favorites',
    TOOLS.slice(0, MAX_FAVORITES).map((t) => t.id),
  );

  const favoriteSet = new Set(favoriteIds);
  const favorites: Tool[] = favoriteIds
    .map((id) => TOOLS.find((t) => t.id === id))
    .filter((t): t is Tool => !!t)
    .slice(0, MAX_FAVORITES); // hard limit khi render

  const byGroup = groupTools(TOOLS);

  function toggleFavorite(id: string) {
    if (favoriteSet.has(id)) {
      setFavoriteIds(favoriteIds.filter((x) => x !== id));
    } else {
      if (favoriteIds.length >= MAX_FAVORITES) {
        toast.error(`Tối đa ${MAX_FAVORITES} pin. Bỏ bớt rồi thêm lại.`);
        return;
      }
      setFavoriteIds([...favoriteIds, id]);
    }
  }

  // ============================================================
  // Drag-to-reorder favorites — LIVE reorder.
  // Trong lúc đang kéo, mỗi lần dragOver cell mới sẽ ngay lập tức
  // cập nhật `favoriteIds` → React re-render → FLIP animation chạy → các cell
  // khác slide nhường chỗ ngay. Cell đang kéo (draggedId) bị mờ tại slot mới
  // của nó. Khi dragEnd chỉ cần clear state.
  // ============================================================
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  function handleDragStart(id: string) {
    setDraggedId(id);
    setInsertIndex(null);
  }

  function handleDragOver(id: string, e: React.DragEvent<HTMLDivElement>) {
    if (!draggedId || draggedId === id) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const dropAfter = e.clientX >= rect.left + rect.width / 2;
    const overIdx = favoriteIds.indexOf(id);
    setInsertIndex(dropAfter ? overIdx + 1 : overIdx);
  }

  function handleDrop() {
    if (draggedId === null || insertIndex === null) {
      setDraggedId(null);
      setInsertIndex(null);
      return;
    }
    const next = favoriteIds.filter((id) => id !== draggedId);
    const fromIdx = favoriteIds.indexOf(draggedId);
    // Adjust index sau khi remove
    const adjusted = insertIndex > fromIdx ? insertIndex - 1 : insertIndex;
    next.splice(adjusted, 0, draggedId);
    setFavoriteIds(next);
    setDraggedId(null);
    setInsertIndex(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setInsertIndex(null);
  }

  // FLIP animation cho favorites khi reorder — đã bỏ, dùng insert indicator thay thế

  // ============================================================
  // Smooth section transition (JS-driven, easeOutCubic ~450ms).
  // Logic:
  //   - Ở section 1 (top<10% viewport) + scroll DOWN → animate xuống section 2
  //   - Ở section 2 đầu (top trong [0.9h, 1.1h]) + scroll UP → animate lên section 1
  //   - Các trường hợp khác (scroll trong section 2) → browser native
  // ============================================================
  const scrollRef = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);

  function smoothScrollTo(target: number, duration = 450) {
    const el = scrollRef.current;
    if (!el) return;
    const start = el.scrollTop;
    const dist = target - start;
    if (Math.abs(dist) < 1) return;
    const t0 = performance.now();
    animatingRef.current = true;

    function step(now: number) {
      if (!el) return;
      const t = Math.min((now - t0) / duration, 1);
      // easeOutCubic — fast start, mềm về cuối
      const eased = 1 - Math.pow(1 - t, 3);
      el.scrollTop = start + dist * eased;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        animatingRef.current = false;
      }
    }
    requestAnimationFrame(step);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      if (!el) return;
      if (animatingRef.current) {
        e.preventDefault();
        return;
      }
      const h = el.clientHeight;
      const top = el.scrollTop;

      // Trong vùng "biên giới" của 2 section đầu (top < 1.1h):
      //  - scroll DOWN → snap về h (đầu section 2)
      //  - scroll UP → snap về 0 (đầu section 1)
      // Ngoài vùng đó (đã cuộn sâu trong section 2) → browser native.
      if (top < h * 1.1) {
        if (e.deltaY > 0 && top < h * 0.9) {
          e.preventDefault();
          smoothScrollTo(h);
          return;
        }
        if (e.deltaY < 0 && top > h * 0.1) {
          e.preventDefault();
          smoothScrollTo(0);
          return;
        }
      }
    }

    let touchY = 0;
    function onTouchStart(e: TouchEvent) {
      touchY = e.touches[0].clientY;
    }
    function onTouchEnd(e: TouchEvent) {
      if (!el) return;
      if (animatingRef.current) return;
      const deltaY = touchY - e.changedTouches[0].clientY;
      if (Math.abs(deltaY) < 50) return;

      const h = el.clientHeight;
      const top = el.scrollTop;
      if (top < h * 1.1) {
        if (deltaY > 0 && top < h * 0.9) smoothScrollTo(h);
        else if (deltaY < 0 && top > h * 0.1) smoothScrollTo(0);
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <Header focusVisible={focusVisible} onShowFocus={() => setFocusVisible(true)} />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto [scrollbar-gutter:stable]"
      >
        <div className="flex h-full flex-col px-[clamp(12px,4vw,8rem)]">
          {/* Section 1: chiếm trọn container */}
          <div className="flex h-full shrink-0 flex-col gap-3 py-4 max-md:py-2">
            {focusVisible && <FocusLayer onHide={() => setFocusVisible(false)} />}

            <section className="min-h-0 flex-1 overflow-y-auto">
              {favorites.length > 0 ? (
                <div
                  className="grid content-start gap-px bg-border"
                  style={{
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(clamp(110px, 8vw, 180px), 1fr))',
                  }}
                >
                  {favorites.map((tool, idx) => {
                    const showInsertBefore = insertIndex === idx;
                    const showInsertAfter = insertIndex === idx + 1 && idx === favorites.length - 1;
                    return (
                      <ToolCell
                        key={tool.id}
                        tool={tool}
                        isFavorite
                        draggable
                        isDragging={draggedId === tool.id}
                        showInsertBefore={showInsertBefore}
                        showInsertAfter={showInsertAfter}
                        onClick={() => handleClick(tool)}
                        onToggleFavorite={() => toggleFavorite(tool.id)}
                        onDragStart={() => handleDragStart(tool.id)}
                        onDragOver={(e) => handleDragOver(tool.id, e)}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
                  Chưa có pin nào. Cuộn xuống và bấm
                  <Pin className="mx-1 inline h-3 w-3" />
                  ở tool bất kỳ để pin lên đây.
                </div>
              )}
            </section>
          </div>

          {/* Section 2: content height tự nhiên */}
          <div className="shrink-0 space-y-6 border-t border-border py-6">
            {GROUP_ORDER.map((group) => {
              const tools = byGroup[group];
              if (tools.length === 0) return null;
              return (
                <section key={group}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </h2>
                  <div
                    className="grid gap-px bg-border"
                    style={{
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(clamp(110px, 8vw, 180px), 1fr))',
                    }}
                  >
                    {tools.map((tool) => (
                      <ToolCell
                        key={tool.id}
                        tool={tool}
                        isFavorite={favoriteSet.has(tool.id)}
                        onClick={() => handleClick(tool)}
                        onToggleFavorite={() => toggleFavorite(tool.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <Footer total={TOOLS.length} favorites={favorites.length} />
    </div>
  );
}

// ============================================================
// Header
// ============================================================
function Header({
  focusVisible,
  onShowFocus,
}: {
  focusVisible: boolean;
  onShowFocus: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-[clamp(1rem,4vw,4rem)] py-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">BiBo Tools</h1>
        <span className="h-1.5 w-1.5 self-center bg-primary" />
      </div>

      <div className="flex items-center gap-2">
        {!focusVisible && (
          <Button variant="outline" size="sm" onClick={onShowFocus} className="gap-1.5">
            <ChevronDown className="h-3.5 w-3.5" />
            Hiện Focus
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={() => alert('Shortcuts modal — sẽ migrate sau')}>
              <Keyboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Phím tắt (Alt+K)</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

// ============================================================
// Footer
// ============================================================
function Footer({ total, favorites }: { total: number; favorites: number }) {
  return (
    <footer className="flex items-center justify-between border-t border-border bg-card px-[clamp(1rem,4vw,4rem)] py-2 text-xs text-muted-foreground">
      <span>
        {favorites}/{MAX_FAVORITES} đã pin · {total} công cụ
      </span>
      <span className="font-mono max-md:hidden">v2.0.0</span>
    </footer>
  );
}

// ============================================================
// ToolCell - card từng tool, hover hiện nút pin/unpin.
// Khi `draggable=true` (favorites) hỗ trợ drag để reorder.
// ============================================================
function ToolCell({
  tool,
  isFavorite,
  onClick,
  onToggleFavorite,
  draggable,
  isDragging,
  showInsertBefore,
  showInsertAfter,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  tool: Tool;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  showInsertBefore?: boolean;
  showInsertAfter?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => e.key === 'Enter' && onClick()}
          draggable={draggable}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', tool.id);
            onDragStart?.();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            onDragOver?.(e);
          }}
          onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
          onDragEnd={onDragEnd}
          className={cn(
            'group relative flex aspect-square flex-col items-center justify-center bg-background p-3',
            'transition-all duration-200',
            'hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            draggable && 'cursor-grab active:cursor-grabbing',
            isDragging && 'opacity-40',
            showInsertBefore && 'border-l-4 border-l-primary',
            showInsertAfter && 'border-r-4 border-r-primary',
          )}
        >
          {/* Pin/unpin button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            draggable={false}
            className={cn(
              'absolute right-1 top-1 flex h-5 w-5 items-center justify-center transition-all',
              'hover:bg-popover',
              isFavorite
                ? 'text-primary opacity-70 hover:opacity-100'
                : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground',
            )}
            title={isFavorite ? 'Bỏ pin' : 'Pin lên đầu'}
            aria-label={isFavorite ? 'Bỏ pin' : 'Pin'}
          >
            {isFavorite ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>

          <ToolIcon
            id={tool.id}
            className="mb-1.5 h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary"
          />
          <span className="text-center text-xs leading-tight text-foreground transition-colors">
            {tool.label}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{tool.label}</span>
        {tool.shortcut && (
          <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-primary">
            {tool.shortcut}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
