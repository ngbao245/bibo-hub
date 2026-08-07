import { useEffect, useId, useMemo, type ReactNode } from 'react';

import type { BackgroundType, BlendMode, BookmarkTheme } from '../types';
import { buildBookmarkPageCss } from './BookmarkBackground';

// ============================================================
// BookmarkPageStyle — apply owner's theme + profile-driven CSS + custom CSS.
// Injects a <style> tag PER INSTANCE (unique ID via useId) with:
//   1. Base structural rules (overlay positioning) — always present.
//   2. Dynamic profile rules (background/overlay/label/title colors) — from settings.
//   3. User custom CSS — appended LAST so it wins the cascade at equal specificity.
//
// All dynamic rules are scoped via `:where(.bibo-bookmark-page)` (specificity 0-1-0)
// so users can override with plain `.bookmark-category-badge { color: red }`.
// No inline `style={{background,color}}` is used on bookmark page elements.
//
// PER-INSTANCE TAG: two components can be mounted at once (route page + CSS editor
// preview). Sharing a single tag id caused editor unmount to remove the tag the
// route page depends on, wiping styles until reload. Each instance now owns its
// own <style id="bookmark-custom-css-:r0:">, cleaned up only when THAT instance
// unmounts. Cascade order determined by DOM insertion order.
// ============================================================

const STYLE_TAG_ID_PREFIX = 'bookmark-custom-css';

// Base rules always injected — only structural / positioning, no visual overrides.
const BASE_CSS = `
:where(.bibo-bookmark-page) .bibo-bookmark-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
`.trim();

interface StyleProfile {
  backgroundType: BackgroundType;
  backgroundValue: string;
  backgroundOverlayColor: string | null;
  backgroundOverlayOpacity: number;
  backgroundBlendMode: BlendMode;
  categoryLabelColor: string | null;
  categoryBgColor: string | null;
  bookmarkTitleColor: string | null;
  heroTitleColor: string | null;
  heroSpaceColor: string | null;
  heroUrlColor: string | null;
}

interface Props {
  theme: BookmarkTheme;
  customCss: string;
  profile?: StyleProfile;
  children: ReactNode;
}

export default function BookmarkPageStyle({ theme, customCss, profile, children }: Props) {
  // Stable per-instance ID for the <style> tag. React 18 useId gives a unique string
  // per component instance that stays constant across re-renders.
  const instanceId = useId();
  const styleTagId = `${STYLE_TAG_ID_PREFIX}-${instanceId.replace(/[^\w-]/g, '')}`;

  // Apply theme via data-theme on <html> only for this route.
  useEffect(() => {
    if (theme === 'system') return; // no override
    const el = document.documentElement;
    const prev = el.getAttribute('data-theme');
    if (theme === 'dark') {
      el.removeAttribute('data-theme');
    } else {
      el.setAttribute('data-theme', theme);
    }
    return () => {
      if (prev === null) el.removeAttribute('data-theme');
      else el.setAttribute('data-theme', prev);
    };
  }, [theme]);

  // Compose final CSS: base + profile rules + user custom CSS (order matters for cascade).
  const cssText = useMemo(() => {
    const parts = [BASE_CSS];
    if (profile) {
      const profileCss = buildBookmarkPageCss(profile);
      if (profileCss) parts.push(profileCss);
    }
    const user = customCss.trim();
    if (user) parts.push(user);
    return parts.join('\n\n');
  }, [profile, customCss]);

  useEffect(() => {
    let tag = document.getElementById(styleTagId) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement('style');
      tag.id = styleTagId;
      document.head.appendChild(tag);
    }
    tag.textContent = cssText;
    return () => {
      const existing = document.getElementById(styleTagId);
      if (existing) existing.remove();
    };
  }, [cssText, styleTagId]);

  return <>{children}</>;
}
