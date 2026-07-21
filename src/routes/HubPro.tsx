
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pin, PinOff, User, LogOut } from 'lucide-react';
import { PencilSparkles } from '@/components/icons/PencilSparkles';
import { useNavigate } from 'react-router-dom';

import { TOOLS, TOOL_GROUPS, type Tool, type ToolGroup } from '@/lib/tools';
import { useToolAction } from '@/hooks/useToolAction';
import { useHubFavorites, useSaveHubFavorites } from '@/api/hubFavorites';
import { useToolCategories } from '@/api/toolCategories';
import { useSaveTheme, useThemeStore } from '@/tools/theme';
import type { ThemeId } from '@/tools/theme';
import { cn } from '@/lib/cn';
import WidgetArea from '@/tools/home-widgets/components/WidgetArea';
import { useAuthStore } from '@/stores/authStore';
import { authClient } from '@/lib/authClient';
import { getAvatarUrl } from '@/api/avatars';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToolIcon } from '@/components/ToolIcon';
import { toast } from '@/components/ui/sonner';
import { LoadingState, EmptyState } from '@/components/shared';
import { useModalStore } from '@/stores/modalStore';

// ============================================================
// HubPro - bß║ún REDESIGNED d├╣ng shadcn/ui
// ============================================================
//
// Layout:
//   Header ΓåÆ Focus Layer ΓåÆ Favorites (full viewport ─æß║ºu) ΓåÆ Categories ΓåÆ Footer
//
// Favorites: shortcut nhanh, chiß║┐m trß╗ìn 100vh ─æß║ºu ti├¬n (trß╗½ header/focus).
// Categories: hiß╗ân thß╗ï Tß║ñT Cß║ó tools sß║»p theo group, scroll xuß╗æng sß║╜ thß║Ñy.
// 1 tool c├│ thß╗â xuß║Ñt hiß╗çn ß╗ƒ cß║ú 2 chß╗ù ΓÇö favorite chß╗ë l├á shortcut.
// Tß╗æi ─æa 24 favorite slots.
// ============================================================

// 6 category fix cß╗⌐ng ΓÇö user kh├┤ng th├¬m/xo├í ─æ╞░ß╗úc.
// Thß╗⌐ tß╗▒ n├áy l├á default order lß║ºn ─æß║ºu v├áo app; user c├│ thß╗â reorder qua Setting.
const DEFAULT_GROUP_ORDER: ToolGroup[] = [
  'Productivity',
  'Finance',
  'Tracking',
  'Utilities',
  'Developer',
  'Admin',
];

const UNASSIGNED_CATEGORY = 'Unassigned';

const MAX_FAVORITES = 24;

export default function HubPro() {
  const handleClick = useToolAction();

  // Filter tools theo profile.allowed_tools. Admin ΓåÆ all tools.
  const profile = useAuthStore((s) => s.profile);
  const visibleTools = useMemo(() => {
    if (!profile) return [] as Tool[];
    if (profile.role === 'admin') return TOOLS;
    if (profile.allowed_tools.includes('*')) return TOOLS;
    return TOOLS.filter((t) => profile.allowed_tools.includes(t.id));
  }, [profile]);

  // Favorites ΓÇö localStorage instant + Supabase sync
  const favQuery = useHubFavorites();
  const saveMut = useSaveHubFavorites();

  const LS_KEY = 'hub_favorites_local';

  // Read initial from localStorage (instant), then override from Supabase when ready
  const [favoriteIds, setFavoriteIdsLocal] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync logic: localStorage is source of truth (always freshest).
  // Only pull from Supabase when localStorage is empty (first-time user / new device).
  useEffect(() => {
    if (!favQuery.data) return;

    const localRaw = localStorage.getItem(LS_KEY);
    const localIds: string[] = localRaw ? JSON.parse(localRaw) : [];
    const supabaseIds = favQuery.data.ids;

    if (localIds.length === 0 && supabaseIds.length > 0) {
      // New device / cleared cache ΓåÆ pull from Supabase
      setFavoriteIdsLocal(supabaseIds);
      try { localStorage.setItem(LS_KEY, JSON.stringify(supabaseIds)); } catch {}
    } else if (localIds.length > 0 && supabaseIds.length === 0) {
      // localStorage has data, Supabase empty ΓåÆ push up (retry sync)
      saveMut.mutate({ ids: localIds, recordId: null });
    }
    // Both have data ΓåÆ localStorage wins (it's always updated on pin action)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favQuery.data]);

  // Save: localStorage instant + debounce Supabase sync
  const setFavoriteIds = useCallback(
    (ids: string[]) => {
      setFavoriteIdsLocal(ids);
      // Instant localStorage backup
      try { localStorage.setItem(LS_KEY, JSON.stringify(ids)); } catch {}
      // Debounce Supabase sync (500ms)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        saveMut.mutate({ ids, recordId: favQuery.data?.recordId ?? null });
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [favQuery.data?.recordId],
  );

  // Flush on tab hidden (visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        saveMut.mutate({ ids: favoriteIds, recordId: favQuery.data?.recordId ?? null });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteIds, favQuery.data?.recordId]);

  const visibleToolIds = useMemo(() => new Set(visibleTools.map((t) => t.id)), [visibleTools]);
  const favoriteSet = new Set(favoriteIds);
  const favorites: Tool[] = favoriteIds
    .map((id) => TOOLS.find((t) => t.id === id))
    .filter((t): t is Tool => !!t && visibleToolIds.has(t.id))
    .slice(0, MAX_FAVORITES); // hard limit khi render

  // Categories ΓÇö l╞░u /Config. Mapping tool ΓåÆ category ho├án to├án dynamic.
  // Ch╞░a config ΓåÆ d├╣ng DEFAULT_GROUP_ORDER, mß╗ìi tool r╞íi v├áo Unassigned.
  const catQuery = useToolCategories();
  const { categoryOrder, toolsByCategory, unassignedTools } = useMemo(() => {
    const catData = catQuery.data?.data;
    const hasCustom = catData && catData.categories.length > 0;

    // Thß╗⌐ tß╗▒ category
    const order: string[] = hasCustom
      ? catData.categories
      : DEFAULT_GROUP_ORDER;

    const grouped: Record<string, Tool[]> = {};
    for (const cat of order) grouped[cat] = [];

    const unassigned: Tool[] = [];
    const mapping = catData?.mapping ?? {};
    for (const tool of visibleTools) {
      const cat = mapping[tool.id];
      if (cat && grouped[cat]) {
        grouped[cat].push(tool);
      } else {
        unassigned.push(tool);
      }
    }

    return {
      categoryOrder: order,
      toolsByCategory: grouped,
      unassignedTools: unassigned,
    };
  }, [catQuery.data, visibleTools]);

  function toggleFavorite(id: string) {
    if (favoriteSet.has(id)) {
      setFavoriteIds(favoriteIds.filter((x) => x !== id));
    } else {
      if (favoriteIds.length >= MAX_FAVORITES) {
        toast.error(`Tß╗æi ─æa ${MAX_FAVORITES} pin. Bß╗Å bß╗¢t rß╗ôi th├¬m lß║íi.`);
        return;
      }
      setFavoriteIds([...favoriteIds, id]);
    }
  }

  // ============================================================
  // Drag-to-reorder favorites ΓÇö LIVE reorder.
  // Trong l├║c ─æang k├⌐o, mß╗ùi lß║ºn dragOver cell mß╗¢i sß║╜ ngay lß║¡p tß╗⌐c
  // cß║¡p nhß║¡t `favoriteIds` ΓåÆ React re-render ΓåÆ FLIP animation chß║íy ΓåÆ c├íc cell
  // kh├íc slide nh╞░ß╗¥ng chß╗ù ngay. Cell ─æang k├⌐o (draggedId) bß╗ï mß╗¥ tß║íi slot mß╗¢i
  // cß╗ºa n├│. Khi dragEnd chß╗ë cß║ºn clear state.
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

  // FLIP animation cho favorites khi reorder ΓÇö ─æ├ú bß╗Å, d├╣ng insert indicator thay thß║┐

  // ============================================================
  // Smooth section transition (JS-driven, easeOutCubic ~450ms).
  // Logic:
  //   - ß╗₧ section 1 (top<10% viewport) + scroll DOWN ΓåÆ animate xuß╗æng section 2
  //   - ß╗₧ section 2 ─æß║ºu (top trong [0.9h, 1.1h]) + scroll UP ΓåÆ animate l├¬n section 1
  //   - C├íc tr╞░ß╗¥ng hß╗úp kh├íc (scroll trong section 2) ΓåÆ browser native
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
      // easeOutCubic ΓÇö fast start, mß╗üm vß╗ü cuß╗æi
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

      // Trong v├╣ng "bi├¬n giß╗¢i" cß╗ºa 2 section ─æß║ºu (top < 1.1h):
      //  - scroll DOWN ΓåÆ snap vß╗ü h (─æß║ºu section 2)
      //  - scroll UP ΓåÆ snap vß╗ü 0 (─æß║ºu section 1)
      // Ngo├ái v├╣ng ─æ├│ (─æ├ú cuß╗Ön s├óu trong section 2) ΓåÆ browser native.
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
      <Header />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto [scrollbar-gutter:stable]"
      >
        <div className="flex h-full flex-col px-[clamp(12px,4vw,8rem)]">
          {/* Section 1: chiß║┐m trß╗ìn container */}
          <div className="flex h-full shrink-0 flex-col gap-3 py-4 max-md:py-2">
            <WidgetArea />

            <section className="min-h-0 flex-1 overflow-y-auto">
              {favQuery.isLoading ? (
                <FavoritesSkeleton />
              ) : favorites.length > 0 ? (
                <div
                  className="grid content-start gap-px bg-border"
                  style={{
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(clamp(110px, 8vw, 180px), 1fr))',
                  }}
                  onDragOver={(e) => {
                    // Chß╗ë fire khi k├⌐o v├áo v├╣ng trß╗æng cß╗ºa grid (kh├┤ng phß║úi child cell)
                    if (!draggedId) return;
                    if (e.target !== e.currentTarget) return;
                    e.preventDefault();
                    setInsertIndex(favoriteIds.length);
                  }}
                  onDrop={handleDrop}
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
                <EmptyState
                  compact
                  icon={Pin}
                  title="Ch╞░a c├│ pin n├áo"
                  description="Cuß╗Ön xuß╗æng v├á bß║Ñm biß╗âu t╞░ß╗úng pin ß╗ƒ tool bß║Ñt kß╗│ ─æß╗â pin l├¬n ─æ├óy."
                />
              )}
            </section>
          </div>

          {/* Section 2: content height tß╗▒ nhi├¬n.
              Khi catQuery c├▓n loading ΓåÆ skeleton grid, tr├ính flash mß╗ìi tool
              v├áo Unassigned rß╗ôi ngay lß║¡p tß╗⌐c nhß║úy vß╗ü category thß║¡t. */}
          <div className="shrink-0 space-y-6 border-t border-border py-6">
            {catQuery.isLoading ? (
              <CategoriesSkeleton />
            ) : (
              <>
                {categoryOrder.map((group) => {
                  const tools = toolsByCategory[group] ?? [];
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

                {/* Unassigned ΓÇö tool ch╞░a ─æ╞░ß╗úc g├ín v├áo category n├áo */}
                {unassignedTools.length > 0 && (
                  <section>
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warning">
                      {UNASSIGNED_CATEGORY}
                      <span className="ml-1.5 font-mono font-normal text-muted-foreground">
                        ({unassignedTools.length})
                      </span>
                    </h2>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      V├áo Config ΓåÆ Tool Categories ─æß╗â k├⌐o c├íc tool n├áy v├áo category.
                    </p>
                    <div
                      className="grid gap-px bg-border"
                      style={{
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(clamp(110px, 8vw, 180px), 1fr))',
                      }}
                    >
                      {unassignedTools.map((tool) => (
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
                )}
              </>
            )}
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
function Header() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profile = useAuthStore((s) => s.profile);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-[clamp(1rem,4vw,4rem)] py-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">BiBo Tools</h1>
        <span className="h-1.5 w-1.5 self-center bg-primary" />
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => toast.info('T├¡nh n─âng g├│p ├╜ ─æang ph├ít triß╗ân')}
              data-flat
              className="relative inline-flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:text-primary"
            >
              {/* Triangle border shape */}
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 2L33 10V26L18 34L3 26V10L18 2Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-border"
                />
              </svg>
              <PencilSparkles className="relative h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>G├│p ├╜</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" data-flat onClick={() => useModalStore.getState().open('shortcuts')}>
              <Keyboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ph├¡m tß║»t (Alt+K)</TooltipContent>
        </Tooltip>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <Button
            variant="outline"
            size="icon"
            data-flat
            className="overflow-hidden rounded-full"
            onClick={() => setUserMenuOpen((v) => !v)}
          >
            {profile?.avatar_url ? (
              <img
                src={getAvatarUrl(profile.avatar_url) ?? ''}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <User className="h-4 w-4" />
            )}
          </Button>
          {userMenuOpen && (
            <div data-flat className="absolute right-0 top-full z-50 mt-1 min-w-[200px] border border-border bg-popover py-1 shadow-md">
              {profile?.username && (
                <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                  {profile.username}
                </div>
              )}

              {/* Theme section */}
              <ThemeMenuSection />

              <div className="border-t border-border" />
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate('/account');
                }}
              >
                <User className="h-3.5 w-3.5" />
                My account
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                onClick={() => {
                  setUserMenuOpen(false);
                  authClient.auth.signOut();
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ============================================================
// Theme menu section (inside user dropdown)
// ============================================================

const THEME_PREVIEWS: { id: ThemeId; label: string; bg: string; accent: string; text: string; ring: string }[] = [
  { id: 'dark', label: 'Dark', bg: '#1e1e1e', accent: '#007acc', text: '#d4d4d4', ring: '#007acc' },
  { id: 'light', label: 'Light', bg: '#fafafa', accent: '#007acc', text: '#1a1a1e', ring: '#007acc' },
  { id: 'cute', label: 'Cute', bg: '#faf6f8', accent: '#9333ea', text: '#3d1f4e', ring: '#9333ea' },
];

function ThemeMenuSection() {
  const theme = useThemeStore((s) => s.theme);
  const is3d = useThemeStore((s) => s.is3d);
  const isRounded = useThemeStore((s) => s.isRounded);
  const isRetro = useThemeStore((s) => s.isRetro);
  const isPill = useThemeStore((s) => s.isPill);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setIs3d = useThemeStore((s) => s.setIs3d);
  const setIsRounded = useThemeStore((s) => s.setIsRounded);
  const setIsRetro = useThemeStore((s) => s.setIsRetro);
  const setIsPill = useThemeStore((s) => s.setIsPill);
  const saveTheme = useSaveTheme();

  const persist = (patch: Partial<{ theme: ThemeId; is3d: boolean; isRounded: boolean; isRetro: boolean; isPill: boolean }>) => {
    const next = {
      theme: patch.theme ?? theme,
      is3d: patch.is3d ?? is3d,
      isRounded: patch.isRounded ?? isRounded,
      isRetro: patch.isRetro ?? isRetro,
      isPill: patch.isPill ?? isPill,
    };
    saveTheme.save(next);
  };

  return (
    <div className="border-b border-border px-3 py-2 space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Theme</p>

      {/* Theme preview cards */}
      <div className="grid grid-cols-3 gap-2">
        {THEME_PREVIEWS.map((t) => (
          <button
            key={t.id}
            data-flat
            onClick={() => {
              setTheme(t.id);
              persist({ theme: t.id });
            }}
            className={cn(
              'relative flex flex-col items-center gap-1.5 rounded-lg p-1.5 transition-all duration-150',
              theme === t.id
                ? 'ring-2'
                : 'ring-1 ring-border hover:ring-foreground/20',
            )}
            style={{
              backgroundColor: t.bg,
              ...(theme === t.id ? { '--tw-ring-color': t.ring } as React.CSSProperties : {}),
            }}
          >
            <div
              className="w-full aspect-[4/3] rounded overflow-hidden"
            >
              <div className="flex flex-col gap-[3px] p-1.5">
                <div className="h-[3px] w-3/4 rounded-sm" style={{ backgroundColor: t.text, opacity: 0.6 }} />
                <div className="h-[3px] w-1/2 rounded-sm" style={{ backgroundColor: t.text, opacity: 0.3 }} />
                <div className="h-[4px] w-2/5 rounded-sm mt-0.5" style={{ backgroundColor: t.accent }} />
              </div>
            </div>
            <span
              className="text-[10px] font-medium"
              style={{ color: t.text }}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {/* Effect toggles ΓÇö bordered cards with themed preview */}
      <div className="grid grid-cols-2 gap-2">
        {/* Lift */}
        <button
          data-flat
          onClick={() => {
            setIs3d(!is3d);
            persist({ is3d: !is3d });
          }}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all duration-150',
            is3d
              ? 'ring-2 ring-primary bg-primary/5'
              : 'ring-1 ring-border hover:ring-foreground/20',
          )}
        >
          {/* Preview: flat button vs raised button */}
          <div className="flex items-end gap-1.5 h-4">
            <div className="h-3 w-8 rounded-sm bg-primary/20" />
            <div className="h-3 w-8 rounded-sm bg-primary/40" style={{ boxShadow: '0 2px 0 0 hsl(var(--primary) / 0.6)' }} />
          </div>
          <span className={cn(
            'text-[10px] font-medium',
            is3d ? 'text-primary' : 'text-muted-foreground',
          )}>
            Lift
          </span>
        </button>

        {/* Subtle (was Rounded) ΓÇö radio with Pill */}
        <button
          data-flat
          onClick={() => {
            const next = !isRounded;
            setIsRounded(next);
            if (next) { setIsPill(false); }
            persist({ isRounded: next, isPill: next ? false : isPill });
          }}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all duration-150',
            isRounded
              ? 'ring-2 ring-primary bg-primary/5'
              : 'ring-1 ring-border hover:ring-foreground/20',
          )}
        >
          {/* Preview: square vs subtle rounded */}
          <div className="flex items-center gap-1.5 h-4">
            <div className="h-4 w-6 border border-primary/30 bg-primary/10" />
            <div className="h-4 w-6 border border-primary/50 bg-primary/20" style={{ borderRadius: '0.375rem' }} />
          </div>
          <span className={cn(
            'text-[10px] font-medium',
            isRounded ? 'text-primary' : 'text-muted-foreground',
          )}>
            Subtle
          </span>
        </button>
      </div>

      {/* Retro + Pill toggles */}
      <div className="grid grid-cols-2 gap-2">
        <button
          data-flat
          disabled={!is3d}
          onClick={() => {
            setIsRetro(!isRetro);
            persist({ isRetro: !isRetro });
          }}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all duration-150',
            !is3d
              ? 'opacity-40 cursor-not-allowed ring-1 ring-border'
              : isRetro
                ? 'ring-2 ring-primary bg-primary/5'
                : 'ring-1 ring-border hover:ring-foreground/20',
          )}
        >
          {/* Preview: colored shadow vs gray shadow */}
          <div className="flex items-end gap-1.5 h-4">
            <div className="h-3 w-7 rounded-sm bg-primary/30" style={{ boxShadow: '0 2px 0 0 hsl(var(--primary) / 0.5)' }} />
            <div className="h-3 w-7 rounded-sm bg-primary/30" style={{ boxShadow: '0 2px 0 0 hsl(0 0% 0% / 0.4)' }} />
          </div>
          <span className={cn(
            'text-[10px] font-medium',
            isRetro ? 'text-primary' : 'text-muted-foreground',
          )}>
            Retro
          </span>
        </button>

        {/* Pill ΓÇö radio with Subtle */}
        <button
          data-flat
          onClick={() => {
            const next = !isPill;
            setIsPill(next);
            if (next) { setIsRounded(false); }
            persist({ isPill: next, isRounded: next ? false : isRounded });
          }}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all duration-150',
            isPill
              ? 'ring-2 ring-primary bg-primary/5'
              : 'ring-1 ring-border hover:ring-foreground/20',
          )}
        >
          {/* Preview: subtle rounded vs pill */}
          <div className="flex items-center gap-1.5 h-4">
            <div className="h-4 w-6 border border-primary/30 bg-primary/10" style={{ borderRadius: '0.375rem' }} />
            <div className="h-4 w-6 border border-primary/50 bg-primary/20" style={{ borderRadius: '9999px' }} />
          </div>
          <span className={cn(
            'text-[10px] font-medium',
            isPill ? 'text-primary' : 'text-muted-foreground',
          )}>
            Pill
          </span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Skeletons ΓÇö beam sweep N h├áng, mß╗ùi h├áng tß╗æc ─æß╗Ö kh├íc nhau
// ============================================================
// Mß╗ùi row = 1 grid clip 1 h├áng, c├│ beam ri├¬ng. Stack nhiß╗üu row vß╗¢i duration
// kh├íc nhau ΓåÆ cß║úm gi├íc "living", kh├┤ng ─æ╞ín ─æiß╗çu.

const GRID_TEMPLATE_COLUMNS =
  'repeat(auto-fill, minmax(clamp(110px, 8vw, 180px), 1fr))';

// Duration cho tß╗½ng row theo index. Beyond 4 rows d├╣ng modulo (hiß║┐m khi cß║ºn).
const ROW_DURATIONS = ['1.4s', '2.4s', '1.8s', '2s'];

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <div className="space-y-px">
      {Array.from({ length: rows }).map((_, i) => (
        <LoadingState
          key={i}
          variant="skeleton"
          count={20}
          maxRows={1}
          itemClassName="aspect-square h-auto w-full"
          className="grid gap-px bg-border"
          style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}
          shimmerDuration={ROW_DURATIONS[i % ROW_DURATIONS.length]}
        />
      ))}
    </div>
  );
}

function FavoritesSkeleton() {
  return <SkeletonRows rows={2} />;
}

function CategoriesSkeleton() {
  // Sß╗æ section = sß╗æ category fix cß╗⌐ng (`TOOL_GROUPS`). Nß║┐u t╞░╞íng lai th├¬m
  // category ΓåÆ tß╗▒ sync, kh├┤ng phß║úi nhß╗¢ update chß╗ù n├áy.
  return (
    <>
      {TOOL_GROUPS.map((g) => (
        <section key={g}>
          <div className="mb-2 h-3 w-24 bg-muted" />
          <SkeletonRows rows={1} />
        </section>
      ))}
    </>
  );
}

// ============================================================
// Footer
// ============================================================
function Footer({ total, favorites }: { total: number; favorites: number }) {
  return (
    <footer className="flex items-center justify-between border-t border-border bg-card px-[clamp(1rem,4vw,4rem)] py-2 text-xs text-muted-foreground">
      <span>
        {favorites}/{total} ─æ├ú pin
      </span>
      <span className="font-mono max-md:hidden">v2.0.0</span>
    </footer>
  );
}

// ============================================================
// ToolCell - card tß╗½ng tool, hover hiß╗çn n├║t pin/unpin.
// Khi `draggable=true` (favorites) hß╗ù trß╗ú drag ─æß╗â reorder.
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
            title={isFavorite ? 'Bß╗Å pin' : 'Pin l├¬n ─æß║ºu'}
            aria-label={isFavorite ? 'Bß╗Å pin' : 'Pin'}
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
      <TooltipContent side="bottom">
        <span>{tool.label}</span>
      </TooltipContent>
    </Tooltip>
  );
}