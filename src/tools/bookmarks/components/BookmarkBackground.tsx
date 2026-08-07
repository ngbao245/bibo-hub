import type { BackgroundType, BlendMode } from '../types';

// ============================================================
// BookmarkBackground — shared background + overlay helpers
// Used by /bookmarks route, /bookmarks/:slug public route, and Settings Live Preview.
//
// Design: All visual settings (background, overlay, label/title colors) are emitted
// as scoped CSS rules by `buildBookmarkPageCss()` and injected via <BookmarkPageStyle>.
// Rules use `:where(.bibo-bookmark-page)` prefix so specificity stays at 0-1-0.
// User custom CSS is appended AFTER these rules → same specificity, later cascade wins.
// No inline `style={{background,color}}` on elements — inline would beat user CSS.
// ============================================================

interface BookmarkPageStyleSource {
  backgroundType: BackgroundType;
  backgroundValue: string;
  backgroundOverlayColor?: string | null;
  backgroundOverlayOpacity?: number;
  backgroundBlendMode?: BlendMode;
  categoryLabelColor?: string | null;
  categoryBgColor?: string | null;
  bookmarkTitleColor?: string | null;
  heroTitleColor?: string | null;
  heroSpaceColor?: string | null;
  heroUrlColor?: string | null;
}

/**
 * Build CSS text applying profile visual settings to `.bibo-bookmark-page` scope.
 * Empty string when profile has no visual overrides (default theme applies).
 * Returned CSS is meant to be injected BEFORE user custom CSS so user wins by cascade.
 */
export function buildBookmarkPageCss(profile: BookmarkPageStyleSource): string {
  const rules: string[] = [];

  // Background — solid/gradient set `background`, image sets `background-image` + sizing.
  if (profile.backgroundType === 'solid' && profile.backgroundValue) {
    rules.push(
      `:where(.bibo-bookmark-page){background:${profile.backgroundValue};}`,
    );
  } else if (profile.backgroundType === 'gradient' && profile.backgroundValue) {
    rules.push(
      `:where(.bibo-bookmark-page){background:${profile.backgroundValue};}`,
    );
  } else if (profile.backgroundType === 'image' && profile.backgroundValue) {
    rules.push(
      `:where(.bibo-bookmark-page){background-image:url(${profile.backgroundValue});background-size:cover;background-position:center;}`,
    );
  }

  // Overlay — only emit when both color set and opacity > 0.
  const overlayOpacity = profile.backgroundOverlayOpacity ?? 0;
  if (profile.backgroundOverlayColor && overlayOpacity > 0) {
    const blend = profile.backgroundBlendMode ?? 'normal';
    rules.push(
      `:where(.bibo-bookmark-page) .bibo-bookmark-overlay{background-color:${profile.backgroundOverlayColor};opacity:${overlayOpacity / 100};mix-blend-mode:${blend};}`,
    );
  }

  // Category label color override.
  if (profile.categoryLabelColor) {
    rules.push(
      `:where(.bibo-bookmark-page) .bookmark-category-badge{color:${profile.categoryLabelColor};}`,
    );
  }

  // Category badge background override (overrides Tailwind `bg-primary`).
  if (profile.categoryBgColor) {
    rules.push(
      `:where(.bibo-bookmark-page) .bookmark-category-badge{background:${profile.categoryBgColor};}`,
    );
  }

  // Bookmark hover title color override.
  if (profile.bookmarkTitleColor) {
    rules.push(
      `:where(.bibo-bookmark-page) .bibo-bookmark-hover-title{color:${profile.bookmarkTitleColor};}`,
    );
  }

  // Hero element color overrides.
  if (profile.heroTitleColor) {
    rules.push(
      `:where(.bibo-bookmark-page) .bibo-hero-title{color:${profile.heroTitleColor};}`,
    );
  }
  if (profile.heroSpaceColor) {
    rules.push(
      `:where(.bibo-bookmark-page) .spaces-link{color:${profile.heroSpaceColor};}`,
    );
  }
  if (profile.heroUrlColor) {
    rules.push(
      `:where(.bibo-bookmark-page) .user-static-link{color:${profile.heroUrlColor};}`,
    );
  }

  return rules.join('\n');
}

interface BookmarkOverlayProps {
  color: string | null;
  opacity: number; // 0..100
  blend: BlendMode;
}

/**
 * Overlay DOM slot. Visual styling comes from CSS rule emitted by `buildBookmarkPageCss`.
 * Returns null when no overlay is configured — keeps DOM clean.
 * NOTE: The `blend` prop is unused directly; kept for API stability with existing callers.
 * The actual mix-blend-mode is applied via the injected CSS rule.
 */
export function BookmarkOverlay({ color, opacity }: BookmarkOverlayProps) {
  if (opacity <= 0 || !color) return null;
  return (
    <div
      aria-hidden
      className="bibo-bookmark-overlay pointer-events-none absolute inset-0 z-0"
    />
  );
}
