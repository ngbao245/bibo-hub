// ============================================================
// Bookmarks tool types
// ============================================================

export type BookmarkTheme = 'light' | 'dark' | 'system';
export type BackgroundType = 'default' | 'solid' | 'gradient' | 'image';
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'soft-light'
  | 'hard-light'
  | 'color-dodge'
  | 'color-burn';

export const BLEND_MODES: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'soft-light',
  'hard-light',
  'color-dodge',
  'color-burn',
];

export interface BookmarkProfile {
  userId: string;
  slug: string;
  spaceName: string;
  columnCount: number; // 1..4
  isPublic: boolean; // page-level public toggle
  theme: BookmarkTheme;
  displayName: string;
  bio: string;
  webpage: string;
  iconSize: number; // 20..60 (px)
  backgroundType: BackgroundType;
  backgroundValue: string; // solid hex, gradient CSS, or image URL
  backgroundOverlayColor: string | null; // hex; null = no overlay
  backgroundOverlayOpacity: number; // 0..100
  backgroundBlendMode: BlendMode;
  iconBackdrop: boolean;
  categoryLabelColor: string | null; // hex color for category badge label; null = theme default
  categoryBgColor: string | null; // hex color for category badge background pill; null = theme default (solid primary)
  bookmarkTitleColor: string | null; // hex color for hover title under category; null = theme default
  heroTitleColor: string | null; // hex color for h1 displayName in hero; null = theme default
  heroSpaceColor: string | null; // hex color for space name link in hero; null = theme default
  heroUrlColor: string | null; // hex color for URL link under hero title; null = theme default
  customCss: string;
  openInSameTab: boolean;
  activePresetId: string | null; // FK bookmark_css_presets.id; null = no preset attached
  customCssDraft: string | null; // debounce-saved unsaved changes; null = clean
  showHero: boolean; // toggle Hero header block above grid; owner status bar always renders separately
  createdAt: string | null;
  updatedAt: string | null;
}

// DEPRECATED enum kept only for row-level column typing + backward-compat mapping.
// Domain uses boolean `showHero` instead. Legacy values 'default'/'both'/'hero'
// map to true; 'hidden' maps to false.
export type HeaderMode = 'default' | 'hero' | 'hidden' | 'both';

export interface BookmarkProfileRow {
  user_id: string;
  slug: string;
  space_name: string;
  column_count: number | null;
  is_public: boolean | null;
  theme: string | null;
  display_name: string | null;
  bio: string | null;
  webpage: string | null;
  icon_size: number | null;
  background_type: string | null;
  background_value: string | null;
  background_overlay_color: string | null;
  background_overlay_opacity: number | null;
  background_blend_mode: string | null;
  icon_backdrop: boolean | null;
  category_label_color: string | null;
  category_bg_color: string | null;
  bookmark_title_color: string | null;
  hero_title_color: string | null;
  hero_space_color: string | null;
  hero_url_color: string | null;
  custom_css: string | null;
  open_in_same_tab: boolean | null;
  active_preset_id: string | null;
  custom_css_draft: string | null;
  header_mode: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================================
// CSS Preset (named bundle of CSS + optional Settings snapshot)
// ============================================================

export interface BookmarkSettingsSnapshot {
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
  iconBackdrop: boolean;
  columnCount: number;
  iconSize: number;
  theme: BookmarkTheme;
}

// JSONB stored shape uses snake_case matching DB column names.
export interface BookmarkSettingsSnapshotJson {
  background_type: BackgroundType;
  background_value: string;
  background_overlay_color: string | null;
  background_overlay_opacity: number;
  background_blend_mode: BlendMode;
  category_label_color: string | null;
  category_bg_color: string | null;
  bookmark_title_color: string | null;
  hero_title_color: string | null;
  hero_space_color: string | null;
  hero_url_color: string | null;
  icon_backdrop: boolean;
  column_count: number;
  icon_size: number;
  theme: BookmarkTheme;
}

export interface BookmarkPreset {
  id: string;
  userId: string;
  name: string;
  css: string;
  includesSettings: boolean;
  settingsSnapshot: BookmarkSettingsSnapshot | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BookmarkPresetRow {
  id: string;
  user_id: string;
  name: string;
  css: string | null;
  includes_settings: boolean | null;
  settings_snapshot: BookmarkSettingsSnapshotJson | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BookmarkCategory {
  id: string;
  userId: string;
  name: string;
  hiddenFromPublic: boolean; // opt-out when page.isPublic
  columnIndex: number;
  orderIndex: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BookmarkCategoryRow {
  id: string;
  user_id: string;
  name: string;
  hidden_from_public: boolean | null;
  is_public: boolean | null; // dead column, ignored
  column_index: number;
  order_index: number;
  created_at: string | null;
  updated_at: string | null;
}

export type BookmarkIconType = 'image' | 'text';

export interface Bookmark {
  id: string;
  userId: string;
  categoryId: string;
  url: string;
  title: string;
  note: string;
  faviconUrl: string | null;
  iconType: BookmarkIconType;
  iconText: string | null;
  iconRounded: boolean | null;
  iconBackground: string | null;
  orderIndex: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BookmarkRow {
  id: string;
  user_id: string;
  category_id: string;
  url: string;
  title: string;
  note: string | null;
  favicon_url: string | null;
  icon_type: string | null;
  icon_text: string | null;
  icon_rounded: boolean | null;
  icon_background: string | null;
  order_index: number;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================================
// Mappers
// ============================================================

const isValidTheme = (t: string | null): t is BookmarkTheme =>
  t === 'light' || t === 'dark' || t === 'system';

const isValidBgType = (t: string | null): t is BackgroundType =>
  t === 'default' || t === 'solid' || t === 'gradient' || t === 'image';

const isValidBlendMode = (t: string | null): t is BlendMode =>
  (BLEND_MODES as string[]).includes(t ?? '');

export function bookmarkProfileRowToDomain(row: BookmarkProfileRow): BookmarkProfile {
  return {
    userId: row.user_id,
    slug: row.slug,
    spaceName: row.space_name ?? '',
    columnCount: Math.max(1, Math.min(4, row.column_count ?? 3)),
    isPublic: row.is_public ?? false,
    theme: isValidTheme(row.theme) ? row.theme : 'system',
    displayName: row.display_name ?? '',
    bio: row.bio ?? '',
    webpage: row.webpage ?? '',
    iconSize: Math.max(20, Math.min(60, row.icon_size ?? 30)),
    backgroundType: isValidBgType(row.background_type) ? row.background_type : 'default',
    backgroundValue: row.background_value ?? '',
    backgroundOverlayColor: row.background_overlay_color,
    backgroundOverlayOpacity: Math.max(0, Math.min(100, row.background_overlay_opacity ?? 0)),
    backgroundBlendMode: isValidBlendMode(row.background_blend_mode)
      ? row.background_blend_mode
      : 'normal',
    // iconBackdrop is DEPRECATED — the per-bookmark iconBackground field replaced it.
    // Force false so no code path draws the legacy white-circle wrapper.
    iconBackdrop: false,
    categoryLabelColor: row.category_label_color,
    categoryBgColor: row.category_bg_color,
    bookmarkTitleColor: row.bookmark_title_color,
    heroTitleColor: row.hero_title_color,
    heroSpaceColor: row.hero_space_color,
    heroUrlColor: row.hero_url_color,
    customCss: row.custom_css ?? '',
    openInSameTab: row.open_in_same_tab ?? false,
    showHero: row.header_mode !== 'hidden', // default true; anything except 'hidden' = show
    activePresetId: row.active_preset_id ?? null,
    customCssDraft: row.custom_css_draft ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// Preset mappers
// ============================================================

function snapshotJsonToDomain(json: BookmarkSettingsSnapshotJson): BookmarkSettingsSnapshot {
  return {
    backgroundType: isValidBgType(json.background_type) ? json.background_type : 'default',
    backgroundValue: json.background_value ?? '',
    backgroundOverlayColor: json.background_overlay_color,
    backgroundOverlayOpacity: Math.max(0, Math.min(100, json.background_overlay_opacity ?? 0)),
    backgroundBlendMode: isValidBlendMode(json.background_blend_mode)
      ? json.background_blend_mode
      : 'normal',
    categoryLabelColor: json.category_label_color,
    categoryBgColor: json.category_bg_color ?? null,
    bookmarkTitleColor: json.bookmark_title_color,
    heroTitleColor: json.hero_title_color ?? null,
    heroSpaceColor: json.hero_space_color ?? null,
    heroUrlColor: json.hero_url_color ?? null,
    // iconBackdrop deprecated — ignore snapshot value.
    iconBackdrop: false,
    columnCount: Math.max(1, Math.min(4, json.column_count ?? 3)),
    iconSize: Math.max(20, Math.min(60, json.icon_size ?? 30)),
    theme: isValidTheme(json.theme) ? json.theme : 'system',
  };
}

export function snapshotDomainToJson(s: BookmarkSettingsSnapshot): BookmarkSettingsSnapshotJson {
  return {
    background_type: s.backgroundType,
    background_value: s.backgroundValue,
    background_overlay_color: s.backgroundOverlayColor,
    background_overlay_opacity: s.backgroundOverlayOpacity,
    background_blend_mode: s.backgroundBlendMode,
    category_label_color: s.categoryLabelColor,
    category_bg_color: s.categoryBgColor,
    bookmark_title_color: s.bookmarkTitleColor,
    hero_title_color: s.heroTitleColor,
    hero_space_color: s.heroSpaceColor,
    hero_url_color: s.heroUrlColor,
    icon_backdrop: s.iconBackdrop,
    column_count: s.columnCount,
    icon_size: s.iconSize,
    theme: s.theme,
  };
}

export function profileToSnapshot(profile: BookmarkProfile): BookmarkSettingsSnapshot {
  return {
    backgroundType: profile.backgroundType,
    backgroundValue: profile.backgroundValue,
    backgroundOverlayColor: profile.backgroundOverlayColor,
    backgroundOverlayOpacity: profile.backgroundOverlayOpacity,
    backgroundBlendMode: profile.backgroundBlendMode,
    categoryLabelColor: profile.categoryLabelColor,
    categoryBgColor: profile.categoryBgColor,
    bookmarkTitleColor: profile.bookmarkTitleColor,
    heroTitleColor: profile.heroTitleColor,
    heroSpaceColor: profile.heroSpaceColor,
    heroUrlColor: profile.heroUrlColor,
    iconBackdrop: profile.iconBackdrop,
    columnCount: profile.columnCount,
    iconSize: profile.iconSize,
    theme: profile.theme,
  };
}

export function bookmarkPresetRowToDomain(row: BookmarkPresetRow): BookmarkPreset {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    css: row.css ?? '',
    includesSettings: row.includes_settings ?? false,
    settingsSnapshot: row.settings_snapshot ? snapshotJsonToDomain(row.settings_snapshot) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function bookmarkCategoryRowToDomain(row: BookmarkCategoryRow): BookmarkCategory {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    hiddenFromPublic: row.hidden_from_public ?? false,
    columnIndex: row.column_index ?? 0,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function bookmarkRowToDomain(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    url: row.url,
    title: row.title,
    note: row.note ?? '',
    faviconUrl: row.favicon_url,
    iconType: row.icon_type === 'text' ? 'text' : 'image',
    iconText: row.icon_text,
    iconRounded: row.icon_rounded,
    iconBackground: row.icon_background,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
