import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  Keyboard,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  SplitSquareHorizontal,
  FileText,
  LayoutGrid,
} from 'lucide-react';

import { useNotes, useCreateNote } from '@/api/notes';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useModalStore } from '@/stores/modalStore';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

import NoteList from '@/components/NoteList';
import NoteEditor from '@/components/NoteEditor';
import type { Note } from '@/schemas/note';

// ============================================================
// Notes Page - layout 3 cột
//
// ┌─────────┬──────────────┬──────────────────────────────┐
// │ Sidebar │  Note List   │  Note Editor                 │
// │ 60px    │  280px       │  (View / Edit mode)          │
// └─────────┴──────────────┴──────────────────────────────┘
//
// Layout mode (cycle bằng Ctrl+B hoặc nút ở đáy sidebar):
// - pinned   : cả sidebar + list luôn hiện
// - compact  : sidebar hiện, list auto-hide (rê chuột vào cạnh trái → hiện)
// - zen      : cả 2 đều auto-hide
//
// Mobile: sidebar 60px ẩn hẳn, list overlay slide theo nút hamburger.
// ============================================================

export default function Notes() {
  const notesQuery = useNotes();
  const createNote = useCreateNote();

  // ============================================================
  // Multi-pane (split-screen) state
  // - panes: tối đa 3 pane, mỗi pane có tabs + activeId riêng
  // - focusedPaneIdx: pane đang được focus (mở note mới sẽ vào pane này)
  // ============================================================
  type PaneState = { tabs: string[]; activeId: string | null };
  const [panes, setPanes] = useLocalStorage<PaneState[]>('notes_panes', [
    { tabs: [], activeId: null },
  ]);
  const [focusedPaneIdx, setFocusedPaneIdx] = useLocalStorage<number>(
    'notes_focusedPaneIdx',
    0,
  );

  // Đảm bảo focusedPaneIdx hợp lệ (panes có thể bị shrink)
  const safeFocusedIdx = Math.min(focusedPaneIdx, panes.length - 1);

  function updatePane(idx: number, patch: Partial<PaneState>) {
    setPanes(panes.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  // Mobile: state mở/đóng list panel
  const [listOpenMobile, setListOpenMobile] = useState(false);

  // Desktop: 3 mode layout (cycle Ctrl+B)
  //   pinned  - sidebar 60px + list 280px luôn hiện (mặc định)
  //   compact - sidebar 60px hiện, list 280px auto-hide (hover edge → hiện)
  //   zen     - cả sidebar + list đều auto-hide (hover edge → cả 2 hiện)
  type LayoutMode = 'pinned' | 'compact' | 'zen';
  const [layoutMode, setLayoutMode] = useLocalStorage<LayoutMode>(
    'notes_layoutMode',
    'pinned',
  );
  const [edgeHovered, setEdgeHovered] = useState(false);

  // Debounce close (mouseLeave): chờ 150ms rồi mới đóng,
  // tránh giựt khi chuột đi qua biên giữa edge zone & panel.
  const closeTimerRef = useRef<number | null>(null);
  function showPanels() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setEdgeHovered(true);
  }
  function schedulePanelsHide() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setEdgeHovered(false);
      closeTimerRef.current = null;
    }, 150);
  }
  // Cleanup timer khi unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function cycleLayoutMode() {
    setLayoutMode(
      layoutMode === 'pinned' ? 'compact' : layoutMode === 'compact' ? 'zen' : 'pinned',
    );
  }

  // 📚 Sync panes với data: gỡ tabs đã bị xoá; auto-mở note đầu khi rỗng.
  useEffect(() => {
    if (!notesQuery.data) return;
    const validIds = new Set(notesQuery.data.map((n: any) => n.id));

    let dirty = false;
    const cleanedPanes = panes.map((p) => {
      const validTabs = p.tabs.filter((id) => validIds.has(id));
      const activeStillValid =
        p.activeId && validIds.has(p.activeId) ? p.activeId : validTabs[0] ?? null;
      if (validTabs.length !== p.tabs.length || activeStillValid !== p.activeId) {
        dirty = true;
      }
      return { tabs: validTabs, activeId: activeStillValid };
    });
    if (dirty) setPanes(cleanedPanes);

    // Pane đầu tiên rỗng → auto-mở note mới nhất
    if (cleanedPanes[0].tabs.length === 0) {
      const regular = notesQuery.data.filter(
        (n: any) =>
          ['note', 'ielts', 'course', 'code'].includes(n.type) && !n.isChildNote,
      );
      if (regular.length > 0) {
        const sorted = [...regular].sort((a, b) => {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        });
        const next = [...cleanedPanes];
        next[0] = { tabs: [sorted[0].id], activeId: sorted[0].id };
        setPanes(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesQuery.data]);

  /** Mở note ID vào pane chỉ định (mặc định là pane đang focus) */
  function openTab(id: string, paneIdx: number = safeFocusedIdx) {
    const next = panes.map((p, i) => {
      if (i !== paneIdx) return p;
      return {
        tabs: p.tabs.includes(id) ? p.tabs : [...p.tabs, id],
        activeId: id,
      };
    });
    setPanes(next);
    setFocusedPaneIdx(paneIdx);
    setListOpenMobile(false);
  }

  /** Đóng tab. Nếu pane rỗng (>1 pane) → đóng cả pane. */
  function closeTab(id: string, paneIdx: number) {
    const pane = panes[paneIdx];
    if (!pane) return;
    const idx = pane.tabs.indexOf(id);
    if (idx === -1) return;

    const nextTabs = pane.tabs.filter((t) => t !== id);
    let nextActive = pane.activeId;
    if (pane.activeId === id) {
      nextActive = nextTabs[idx - 1] ?? nextTabs[idx] ?? null;
    }

    if (nextTabs.length === 0 && panes.length > 1) {
      // Pane rỗng + còn pane khác → close pane luôn
      const nextPanes = panes.filter((_, i) => i !== paneIdx);
      setPanes(nextPanes);
      if (focusedPaneIdx >= nextPanes.length) {
        setFocusedPaneIdx(nextPanes.length - 1);
      }
      return;
    }

    updatePane(paneIdx, { tabs: nextTabs, activeId: nextActive });
  }

  /** Split: copy active tab sang pane mới (max 3) */
  function splitPane(fromIdx: number = safeFocusedIdx) {
    if (panes.length >= 3) {
      toast.info('Tối đa 3 panes');
      return;
    }
    const fromPane = panes[fromIdx];
    if (!fromPane?.activeId) {
      toast.info('Cần có tab đang mở để split');
      return;
    }
    const newPane: PaneState = {
      tabs: [fromPane.activeId],
      activeId: fromPane.activeId,
    };
    // Insert ngay sau pane hiện tại
    const next = [...panes];
    next.splice(fromIdx + 1, 0, newPane);
    setPanes(next);
    setFocusedPaneIdx(fromIdx + 1);
  }

  function handleNew() {
    createNote.mutate(
      { title: 'Note mới', content: '', type: 'note' },
      {
        onSuccess: (newNote) => {
          openTab(newNote.id);
          toast.success('Đã tạo note mới');
        },
        onError: () => toast.error('Không tạo được note'),
      },
    );
  }

  // Active note của pane đang focus (cho mobile header hiển thị)
  const focusedPane = panes[safeFocusedIdx];
  const focusedActiveNote =
    notesQuery.data?.find((n: any) => n.id === focusedPane?.activeId) ?? null;

  // Ctrl+B: cycle layout. Ctrl+W: đóng tab focused. Ctrl+Tab: switch tab focused.
  // Ctrl+\: split pane.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        cycleLayoutMode();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        splitPane();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        const pane = panes[safeFocusedIdx];
        if (pane?.activeId) {
          e.preventDefault();
          closeTab(pane.activeId, safeFocusedIdx);
        }
        return;
      }
      if (e.ctrlKey && e.key === 'Tab') {
        const pane = panes[safeFocusedIdx];
        if (pane && pane.tabs.length > 1) {
          e.preventDefault();
          const idx = pane.activeId ? pane.tabs.indexOf(pane.activeId) : -1;
          const nextIdx = e.shiftKey
            ? (idx - 1 + pane.tabs.length) % pane.tabs.length
            : (idx + 1) % pane.tabs.length;
          updatePane(safeFocusedIdx, { activeId: pane.tabs[nextIdx] });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode, panes, safeFocusedIdx]);

  return (
    <div className="flex h-full">
      {/* Edge hover zone — active khi compact/zen, hover sẽ đánh thức panel auto-hide.
          Rộng 80px. Luôn render để tránh re-mount gây giựt; tắt pointer-events khi
          panel đã mở (lúc đó panel tự bắt mouseenter của nó). */}
      {layoutMode !== 'pinned' && (
        <div
          onMouseEnter={showPanels}
          className={cn(
            'fixed inset-y-0 left-0 z-[1100] w-20 max-md:hidden',
            edgeHovered && 'pointer-events-none',
          )}
          aria-hidden="true"
        />
      )}

      {/* Sidebar 60px
          - pinned/compact: nằm trong flow, luôn hiện
          - zen: fixed, slide ngoài khung khi không hover */}
      <aside
        onMouseEnter={() => layoutMode !== 'pinned' && showPanels()}
        onMouseLeave={() => layoutMode === 'zen' && schedulePanelsHide()}
        className={cn(
          'flex w-[60px] shrink-0 flex-col border-r border-border bg-card max-md:hidden',
          layoutMode === 'zen' &&
          'fixed inset-y-0 left-0 z-[1101] shadow-2xl transition-transform duration-200',
          layoutMode === 'zen' && !edgeHovered && '-translate-x-full',
        )}
      >
        <Link
          to="/"
          className="flex h-12 items-center justify-center border-b border-border text-muted-foreground transition-colors hover:bg-popover hover:text-foreground"
          title="Hub"
        >
          <LayoutGrid className="h-5 w-5 opacity-70" />
        </Link>
        <Link
          to="/notes"
          className="flex h-12 items-center justify-center border-b border-border bg-popover text-primary"
          title="Notes"
        >
          <span className="text-xs font-medium">Notes</span>
        </Link>
        <Link
          to="/tasks"
          className="flex h-12 items-center justify-center border-b border-border text-muted-foreground transition-colors hover:bg-popover hover:text-foreground"
          title="Tasks"
        >
          <span className="text-xs font-medium">Tasks</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Toggle layout mode (cycle pinned → compact → zen). Phím tắt: Ctrl+B */}
        <button
          onClick={cycleLayoutMode}
          className="flex h-12 items-center justify-center border-t border-border text-muted-foreground transition-colors hover:bg-popover hover:text-foreground"
          title={layoutModeTitle(layoutMode)}
        >
          {layoutMode === 'pinned' && <PanelLeftClose className="h-4 w-4" />}
          {layoutMode === 'compact' && <PanelLeft className="h-4 w-4" />}
          {layoutMode === 'zen' && <PanelLeftOpen className="h-4 w-4" />}
        </button>

        {/* Shortcut modal */}
        <button
          onClick={() => useModalStore.getState().open('shortcuts')}
          className="flex h-12 items-center justify-center border-t border-border text-muted-foreground transition-colors hover:bg-popover hover:text-foreground"
          title="Phím tắt"
        >
          <Keyboard className="h-4 w-4" />
        </button>
      </aside>

      {/* Note list panel 280px
          - pinned: trong flow, luôn hiện
          - compact/zen: fixed bên trái sidebar, slide vào/ra theo edgeHovered
          - Mobile: fixed overlay, slide theo listOpenMobile */}
      <aside
        onMouseEnter={() => layoutMode !== 'pinned' && showPanels()}
        onMouseLeave={() => layoutMode !== 'pinned' && schedulePanelsHide()}
        className={cn(
          'flex w-[280px] shrink-0 flex-col border-r border-border bg-card max-md:hidden',
          // Compact + Zen: fixed, sang phải sidebar 60px
          layoutMode !== 'pinned' &&
          'fixed inset-y-0 left-[60px] z-[1101] shadow-2xl transition-transform duration-200',
          layoutMode !== 'pinned' && !edgeHovered && '-translate-x-[calc(100%+60px)]',
          // Mobile fixed overlay
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[1000] max-md:flex max-md:transition-transform',
          listOpenMobile ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
        )}
      >
        <NoteList
          notes={notesQuery.data ?? []}
          isLoading={notesQuery.isLoading}
          selectedId={focusedPane?.activeId ?? null}
          onSelect={(id) => openTab(id)}
          onNew={handleNew}
        />
      </aside>

      {/* Mobile overlay khi list đang mở */}
      {listOpenMobile && (
        <div
          className="fixed inset-0 z-[999] bg-black/50 md:hidden"
          onClick={() => setListOpenMobile(false)}
        />
      )}

      {/* Editor area: N panes side-by-side */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="hidden items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 max-md:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setListOpenMobile((v) => !v)}
            className="h-8 w-8"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h2 className="truncate text-sm font-medium">
            {focusedActiveNote?.title || 'Notes'}
          </h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link to="/">
                <LayoutGrid className="h-4 w-4 opacity-70" />
              </Link>
            </Button>
          </div>
        </header>

        {/* Panes container: flex row, mỗi pane có editor riêng. Mobile chỉ show focused pane. */}
        <div className="flex flex-1 overflow-hidden max-md:contents">
          {panes.map((pane, idx) => {
            const isFocused = idx === safeFocusedIdx;
            const tabsResolved: Note[] = pane.tabs
              .map((id) => notesQuery.data?.find((n: any) => n.id === id))
              .filter((n: any): n is Note => !!n);
            const activeNote =
              notesQuery.data?.find((n: any) => n.id === pane.activeId) ?? null;

            return (
              <section
                key={idx}
                onMouseDown={() => setFocusedPaneIdx(idx)}
                className={cn(
                  'flex flex-1 flex-col overflow-hidden',
                  // Border giữa các pane
                  idx > 0 && 'border-l border-border',
                  // Highlight pane đang focus (chỉ khi >1 pane)
                  panes.length > 1 && isFocused && 'ring-1 ring-inset ring-primary/40',
                  // Mobile: chỉ show focused pane (CSS pure, không phải conditional render)
                  !isFocused && 'max-md:hidden',
                )}
              >
                {/* Tab bar — luôn hiện kể cả 0 tab để có nút Split */}
                <TabBar
                  tabs={tabsResolved}
                  activeId={pane.activeId}
                  onActivate={(id) => updatePane(idx, { activeId: id })}
                  onClose={(id) => closeTab(id, idx)}
                  onSplit={() => splitPane(idx)}
                  canSplit={panes.length < 3 && !!pane.activeId}
                  showCloseAll={panes.length > 1}
                  onCloseAll={() => {
                    const next = panes.filter((_, i) => i !== idx);
                    setPanes(next);
                    if (focusedPaneIdx >= next.length) {
                      setFocusedPaneIdx(next.length - 1);
                    }
                  }}
                />

                {/* Editor */}
                {activeNote ? (
                  <NoteEditor
                    key={activeNote.id}
                    note={activeNote}
                    allNotes={notesQuery.data ?? []}
                    onDeleted={() => closeTab(activeNote.id, idx)}
                    onSelectNote={(id) => openTab(id, idx)}
                  />
                ) : (
                  <EmptyState onNew={handleNew} />
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// ============================================================
// TabBar — hiển thị các note trong 1 pane + nút split/close-pane
// ============================================================
function TabBar({
  tabs,
  activeId,
  onActivate,
  onClose,
  onSplit,
  canSplit,
  showCloseAll,
  onCloseAll,
}: {
  tabs: Note[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onSplit: () => void;
  canSplit: boolean;
  showCloseAll: boolean;
  onCloseAll: () => void;
}) {
  return (
    <div className="flex shrink-0 items-stretch border-b border-border bg-muted">
      {/* Tabs */}
      <div className="flex flex-1 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = t.id === activeId;
          return (
            <div
              key={t.id}
              className={cn(
                'group flex shrink-0 items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs transition-colors',
                isActive
                  ? 'bg-card text-foreground'
                  : 'text-muted-foreground hover:bg-card/50 hover:text-foreground',
              )}
            >
              <button
                type="button"
                onClick={() => onActivate(t.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onClose(t.id);
                  }
                }}
                className="flex items-center gap-1.5"
                title={t.title || 'Untitled'}
              >
                {t.isChildNote && <FileText className="h-3 w-3 shrink-0" />}
                <span className="max-w-[180px] truncate">
                  {t.title || 'Untitled'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onClose(t.id)}
                className={cn(
                  'flex h-4 w-4 items-center justify-center transition-colors hover:bg-popover hover:text-foreground',
                  !isActive && 'opacity-0 group-hover:opacity-100',
                )}
                title="Đóng tab (Ctrl+W)"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Pane actions */}
      <div className="flex shrink-0 items-center gap-0.5 border-l border-border px-1">
        <button
          type="button"
          onClick={onSplit}
          disabled={!canSplit}
          className="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-popover hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          title="Split pane (Ctrl+\\) — tối đa 3"
        >
          <SplitSquareHorizontal className="h-3.5 w-3.5" />
        </button>
        {showCloseAll && (
          <button
            type="button"
            onClick={onCloseAll}
            className="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-popover hover:text-destructive"
            title="Đóng pane này"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <p className="mb-4 text-muted-foreground">Chọn một note hoặc tạo note mới</p>
        <Button onClick={onNew} className="gap-1.5">
          <span>+</span>
          Tạo note mới
        </Button>
      </div>
    </div>
  );
}

function layoutModeTitle(mode: 'pinned' | 'compact' | 'zen'): string {
  switch (mode) {
    case 'pinned':
      return 'Layout: Pinned (sidebar + list luôn hiện) → Ctrl+B để chuyển Compact';
    case 'compact':
      return 'Layout: Compact (sidebar hiện, list auto-hide) → Ctrl+B để chuyển Zen';
    case 'zen':
      return 'Layout: Zen (cả 2 auto-hide) → Ctrl+B để quay lại Pinned';
  }
}
