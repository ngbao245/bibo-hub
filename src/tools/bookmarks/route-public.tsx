import { useMemo, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark as BookmarkIcon,
  ExternalLink,
  Pencil,
  Search,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared';
import { useAuthStore } from '@/stores/authStore';

import BookmarkFavicon from './components/BookmarkFavicon';
import BookmarksSkeleton from './components/BookmarksSkeleton';
import { BookmarkOverlay } from './components/BookmarkBackground';
import BookmarkPageStyle from './components/BookmarkPageStyle';
import { BookmarkHeader } from './components/BookmarkHeader';
import {
  fetchPublicBookmarks,
  type PublicBookmark,
  type PublicCategory,
} from './lib/edge-functions';
import { useBookmarkProfile } from './api';
import { getPublicUrl } from '@/lib/basename';

// ============================================================
// BookmarksPublic — read-only public view (no auth)
// ============================================================

const OPEN_ALL_CONFIRM_THRESHOLD = 10;

export default function BookmarksPublic() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [search, setSearch] = useState('');
  const [hoverByCat, setHoverByCat] = useState<Record<string, string | null>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ['bookmarks', 'public', slug],
    queryFn: () => fetchPublicBookmarks(slug),
    retry: false,
  });

  const ownProfileQuery = useBookmarkProfile();
  const authProfile = useAuthStore((s) => s.profile);
  const isOwner = Boolean(authProfile && ownProfileQuery.data?.slug === slug);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearch('');
        searchRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const matchesSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return () => true;
    return (b: PublicBookmark) =>
      b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q);
  }, [search]);

  const bookmarksByCategory = useMemo(() => {
    const map = new Map<string, PublicBookmark[]>();
    for (const b of query.data?.bookmarks ?? []) {
      const arr = map.get(b.categoryId) ?? [];
      arr.push(b);
      map.set(b.categoryId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.orderIndex - b.orderIndex);
    return map;
  }, [query.data]);

  function categoryHasMatch(cat: PublicCategory): boolean {
    if (!search.trim()) return true;
    return (bookmarksByCategory.get(cat.id) ?? []).some(matchesSearch);
  }

  function openAll(cat: PublicCategory) {
    const list = bookmarksByCategory.get(cat.id) ?? [];
    if (list.length === 0) return;
    if (list.length > OPEN_ALL_CONFIRM_THRESHOLD) {
      if (!window.confirm(`Mở ${list.length} tab?`)) return;
    }
    const target = query.data?.profile.openInSameTab ? '_self' : '_blank';
    for (const b of list) window.open(b.url, target, 'noopener,noreferrer');
  }

  if (query.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <header className="border-b border-border bg-card px-4 py-3">
          <Skeleton className="h-5 w-32 rounded" />
        </header>
        <div className="flex-1 overflow-hidden p-4">
          <BookmarksSkeleton />
        </div>
      </div>
    );
  }

  if (query.isError) {
    // Any error → show "not found" (privacy: don't leak existence / cause of failure).
    // Owner viewing own private page gets a special hint.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-6">
        <EmptyState
          icon={BookmarkIcon}
          title={`Không tìm thấy /${slug}`}
          description="Slug này chưa có ai dùng. Kiểm tra lại URL."
          action={
            isOwner ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Đây là slug của bạn nhưng đang private.
                </p>
                <Button asChild>
                  <Link to="/bookmarks">
                    <Pencil className="mr-1 h-4 w-4" /> Bật public trong Settings
                  </Link>
                </Button>
              </div>
            ) : undefined
          }
        />
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;
  const { profile, categories } = data;

  const columnCount = profile.columnCount;
  const iconSize = profile.iconSize;
  const openInSameTab = profile.openInSameTab;

  const displayLabel = profile.displayName || profile.slug;

  // Mobile stacks to 1 col; from md up honor user's exact column choice.
  const gridColsClass = ['', 'grid-cols-1', 'grid-cols-1 md:grid-cols-2', 'grid-cols-1 md:grid-cols-3', 'grid-cols-1 md:grid-cols-4'][columnCount] ?? 'grid-cols-1 md:grid-cols-3';

  return (
    <BookmarkPageStyle theme={profile.theme} customCss={profile.customCss} profile={profile}>
      <div className="bibo-bookmark-page relative flex h-full flex-col overflow-hidden">
        <BookmarkOverlay
          color={profile.backgroundOverlayColor}
          opacity={profile.backgroundOverlayOpacity}
          blend={profile.backgroundBlendMode}
        />
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <BookmarkIcon className="h-4 w-4 text-primary" />
              <h1 className="text-sm font-semibold text-foreground">Bookmarks</h1>
            </div>

            <div className="relative ml-auto max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Press / to search"
                aria-label="Search bookmarks"
                className="h-8 pl-8 pr-16 text-xs"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <kbd className="hidden h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
                    /
                  </kbd>
                )}
              </div>
            </div>

          </div>

        </header>

        {/* Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4">
          <section className="mx-auto mb-4 w-[90%] max-w-[2250px] px-8">
            <BookmarkHeader
              showHero={profile.showHero}
              displayName={displayLabel}
              spaceName={profile.spaceName}
              publicUrl={getPublicUrl(`/bookmarks/${profile.slug}`)}
              webpage={profile.webpage}
            />
          </section>
          {categories.length === 0 ? (
            <EmptyState
              icon={BookmarkIcon}
              title="Chưa có bookmark public"
              description={`User @${profile.slug} chưa share bookmark nào.`}
            />
          ) : (
            <div className="mx-auto w-[90%] max-w-[2250px]">
              <div
                className={`grid gap-6 ${gridColsClass}`}
                style={{
                  gridTemplateRows: `repeat(${Math.max(
                    1,
                    ...Array.from({ length: columnCount }, (_, i) =>
                      categories.filter((c) => c.columnIndex === i).length,
                    ),
                  )}, auto)`,
                }}
              >
                {Array.from({ length: columnCount }, (_, colIdx) => {
                  const colCats = categories
                    .filter((c) => c.columnIndex === colIdx)
                    .sort((a, b) => a.orderIndex - b.orderIndex);
                  if (colCats.length === 0) return <div key={colIdx} />;
                  return (
                    <div key={colIdx} className="grid gap-6 [grid-template-rows:subgrid] [grid-row:1/-1]">
                      {colCats.map((cat) => {
                        const catMatch = categoryHasMatch(cat);
                        return (
                          <div
                            key={cat.id}
                            className="transition-opacity"
                            style={{ opacity: catMatch ? 1 : 0.15 }}
                            aria-hidden={!catMatch || undefined}
                          >
                            <div className="mb-2 flex items-center gap-1.5">
                              <span
                                className="bookmark-category-badge inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm"
                              >
                                {cat.name}
                              </span>
                              {(bookmarksByCategory.get(cat.id) ?? []).length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="ml-auto h-6 w-6"
                                  onClick={() => openAll(cat)}
                                  title="Open all"
                                  aria-label="Open all"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>

                            <ul
                              className="m-0 flex flex-wrap gap-1.5 p-0"
                              style={{ listStyle: 'none', minHeight: iconSize + 4 }}
                            >
                              {(bookmarksByCategory.get(cat.id) ?? []).map((b) => {
                                const bmMatch = matchesSearch(b);
                                const accessibleLabel =
                                  b.title || b.url.replace(/^https?:\/\//, '').replace(/\/$/, '') || b.url;
                                return (
                                  <li
                                    key={b.id}
                                    style={{ opacity: bmMatch ? 1 : 0.15 }}
                                    onMouseEnter={() =>
                                      setHoverByCat((prev) => ({ ...prev, [cat.id]: b.title }))
                                    }
                                    onMouseLeave={() =>
                                      setHoverByCat((prev) => ({ ...prev, [cat.id]: null }))
                                    }
                                    title={b.title || b.url}
                                    className="cursor-pointer"
                                    aria-hidden={!bmMatch || undefined}
                                  >
                                    <a
                                      href={b.url}
                                      target={openInSameTab ? '_self' : '_blank'}
                                      rel={openInSameTab ? undefined : 'noopener noreferrer'}
                                      aria-label={accessibleLabel}
                                      tabIndex={bmMatch ? undefined : -1}
                                    >
                                      <BookmarkFavicon
                                        faviconUrl={b.faviconUrl}
                                        title={b.title}
                                        url={b.url}
                                        size={iconSize}
                                        backdrop={profile.iconBackdrop}
                                        iconType={b.iconType}
                                        iconText={b.iconText}
                                        iconRounded={b.iconRounded}
                                        iconBackground={b.iconBackground}
                                      />
                                    </a>
                                  </li>
                                );
                              })}
                            </ul>

                            <p
                              className={
                                'bibo-bookmark-hover-title mt-1.5 min-h-[14px] text-[11px] text-muted-foreground/70 transition-opacity duration-150 ' +
                                (hoverByCat[cat.id] ? 'opacity-100' : 'opacity-0')
                              }
                            >
                              {hoverByCat[cat.id] || '\u00A0'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {search.trim() && categories.every((c) => !categoryHasMatch(c)) && (
            <p
              role="status"
              aria-live="polite"
              className="mt-6 text-center text-xs text-muted-foreground"
            >
              Không tìm thấy kết quả cho &ldquo;{search}&rdquo;
            </p>
          )}
        </div>
      </div>
    </BookmarkPageStyle>
  );
}
