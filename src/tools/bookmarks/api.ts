import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  workspaceSelect,
  workspaceInsert,
  workspaceUpdate,
  workspaceDelete,
  workspaceUpsert,
  workspaceRpc,
} from '@/lib/workspace/client';
import { optimisticList } from '@/lib/optimistic';
import { useAuthStore } from '@/stores/authStore';

import {
  bookmarkProfileRowToDomain,
  bookmarkCategoryRowToDomain,
  bookmarkRowToDomain,
  bookmarkPresetRowToDomain,
  snapshotDomainToJson,
  type Bookmark,
  type BookmarkCategory,
  type BookmarkPreset,
  type BookmarkPresetRow,
  type BookmarkProfile,
  type BookmarkProfileRow,
  type BookmarkCategoryRow,
  type BookmarkRow,
  type BookmarkSettingsSnapshot,
  type BookmarkTheme,
  type BackgroundType,
  type BlendMode,
} from './types';
import { sanitizeUsernameToSlug } from './schemas';
import { fetchBookmarkMeta } from './lib/edge-functions';

// ============================================================
// Query keys
// ============================================================

export const QK = {
  profile: () => ['bookmarks', 'profile'] as const,
  categories: () => ['bookmarks', 'categories'] as const,
  items: () => ['bookmarks', 'items'] as const,
  slugAvailable: (slug: string) => ['bookmarks', 'slug-available', slug] as const,
  presets: () => ['bookmarks', 'presets'] as const,
};

// ============================================================
// Profile
// ============================================================

async function fetchProfile(): Promise<BookmarkProfile | null> {
  const rows = await workspaceSelect<BookmarkProfileRow>('bookmark_profiles', { limit: 1 });
  const row = rows[0];
  return row ? bookmarkProfileRowToDomain(row) : null;
}

export function useBookmarkProfile() {
  return useQuery({ queryKey: QK.profile(), queryFn: fetchProfile });
}

export function useEnsureBookmarkProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<BookmarkProfile> => {
      const existing = await fetchProfile();
      if (existing) return existing;
      const profile = useAuthStore.getState().profile;
      if (!profile) throw new Error('Chưa đăng nhập');
      const slug = sanitizeUsernameToSlug(profile.username ?? profile.id, profile.id);
      const row = await workspaceInsert<BookmarkProfileRow>('bookmark_profiles', {
        slug,
        space_name: '',
        display_name: profile.username ?? '',
      });
      return bookmarkProfileRowToDomain(row);
    },
    onSuccess: (profile) => {
      qc.setQueryData(QK.profile(), profile);
    },
  });
}

export interface UpdateProfileInput {
  slug?: string;
  spaceName?: string;
  columnCount?: number;
  isPublic?: boolean;
  theme?: BookmarkTheme;
  displayName?: string;
  bio?: string;
  webpage?: string;
  iconSize?: number;
  backgroundType?: BackgroundType;
  backgroundValue?: string;
  backgroundOverlayColor?: string | null;
  backgroundOverlayOpacity?: number;
  backgroundBlendMode?: BlendMode;
  iconBackdrop?: boolean;
  categoryLabelColor?: string | null;
  categoryBgColor?: string | null;
  bookmarkTitleColor?: string | null;
  heroTitleColor?: string | null;
  heroSpaceColor?: string | null;
  heroUrlColor?: string | null;
  customCss?: string;
  openInSameTab?: boolean;
  activePresetId?: string | null;
  customCssDraft?: string | null;
  showHero?: boolean; // mapped to DB header_mode: true -> 'hero', false -> 'hidden'
}

const PROFILE_FIELD_MAP: Record<keyof UpdateProfileInput, string> = {
  slug: 'slug',
  spaceName: 'space_name',
  columnCount: 'column_count',
  isPublic: 'is_public',
  theme: 'theme',
  displayName: 'display_name',
  bio: 'bio',
  webpage: 'webpage',
  iconSize: 'icon_size',
  backgroundType: 'background_type',
  backgroundValue: 'background_value',
  backgroundOverlayColor: 'background_overlay_color',
  backgroundOverlayOpacity: 'background_overlay_opacity',
  backgroundBlendMode: 'background_blend_mode',
  iconBackdrop: 'icon_backdrop',
  categoryLabelColor: 'category_label_color',
  categoryBgColor: 'category_bg_color',
  bookmarkTitleColor: 'bookmark_title_color',
  heroTitleColor: 'hero_title_color',
  heroSpaceColor: 'hero_space_color',
  heroUrlColor: 'hero_url_color',
  customCss: 'custom_css',
  openInSameTab: 'open_in_same_tab',
  activePresetId: 'active_preset_id',
  customCssDraft: 'custom_css_draft',
  showHero: 'header_mode', // domain boolean → DB enum string ('hero' | 'hidden')
};

export function useUpdateBookmarkProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<BookmarkProfile> => {
      const current =
        qc.getQueryData<BookmarkProfile | null>(QK.profile()) ?? (await fetchProfile());
      if (!current) throw new Error('Chưa có profile — hãy load trước');

      // Build ONLY the changed fields (field-level patch, not full-row upsert)
      const patch: Record<string, unknown> = {};
      for (const key of Object.keys(input) as Array<keyof UpdateProfileInput>) {
        const value = input[key];
        if (value === undefined) continue;
        // showHero (domain boolean) → header_mode DB enum
        if (key === 'showHero') {
          patch.header_mode = value ? 'hero' : 'hidden';
          continue;
        }
        patch[PROFILE_FIELD_MAP[key]] = value;
      }

      if (Object.keys(patch).length === 0) return current;

      // Always include slug so upsert INSERT path doesn't violate NOT NULL
      if (!patch.slug) patch.slug = current.slug;

      const row = await workspaceUpsert<BookmarkProfileRow>('bookmark_profiles', patch, {
        onConflict: 'user_id',
        single: true,
      });
      return bookmarkProfileRowToDomain(row);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: QK.profile() });
      const previous = qc.getQueryData<BookmarkProfile | null>(QK.profile());
      if (previous) {
        qc.setQueryData<BookmarkProfile>(QK.profile(), {
          ...previous,
          slug: input.slug ?? previous.slug,
          spaceName: input.spaceName ?? previous.spaceName,
          columnCount: input.columnCount ?? previous.columnCount,
          isPublic: input.isPublic ?? previous.isPublic,
          theme: input.theme ?? previous.theme,
          displayName: input.displayName ?? previous.displayName,
          bio: input.bio ?? previous.bio,
          webpage: input.webpage ?? previous.webpage,
          iconSize: input.iconSize ?? previous.iconSize,
          backgroundType: input.backgroundType ?? previous.backgroundType,
          backgroundValue: input.backgroundValue ?? previous.backgroundValue,
          backgroundOverlayColor:
            input.backgroundOverlayColor !== undefined
              ? input.backgroundOverlayColor
              : previous.backgroundOverlayColor,
          backgroundOverlayOpacity:
            input.backgroundOverlayOpacity ?? previous.backgroundOverlayOpacity,
          backgroundBlendMode: input.backgroundBlendMode ?? previous.backgroundBlendMode,
          iconBackdrop: input.iconBackdrop ?? previous.iconBackdrop,
          categoryLabelColor:
            input.categoryLabelColor !== undefined
              ? input.categoryLabelColor
              : previous.categoryLabelColor,
          categoryBgColor:
            input.categoryBgColor !== undefined ? input.categoryBgColor : previous.categoryBgColor,
          bookmarkTitleColor:
            input.bookmarkTitleColor !== undefined
              ? input.bookmarkTitleColor
              : previous.bookmarkTitleColor,
          heroTitleColor:
            input.heroTitleColor !== undefined ? input.heroTitleColor : previous.heroTitleColor,
          heroSpaceColor:
            input.heroSpaceColor !== undefined ? input.heroSpaceColor : previous.heroSpaceColor,
          heroUrlColor:
            input.heroUrlColor !== undefined ? input.heroUrlColor : previous.heroUrlColor,
          customCss: input.customCss ?? previous.customCss,
          openInSameTab: input.openInSameTab ?? previous.openInSameTab,
          activePresetId:
            input.activePresetId !== undefined ? input.activePresetId : previous.activePresetId,
          customCssDraft:
            input.customCssDraft !== undefined ? input.customCssDraft : previous.customCssDraft,
          showHero: input.showHero ?? previous.showHero,
        });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(QK.profile(), ctx.previous);
    },
    onSuccess: (profile) => {
      qc.setQueryData(QK.profile(), profile);
    },
  });
}

// ============================================================
// Categories
// ============================================================

async function fetchCategories(): Promise<BookmarkCategory[]> {
  const rows = await workspaceSelect<BookmarkCategoryRow>('bookmark_categories', {
    order: { column: 'order_index', ascending: true },
  });
  return rows
    .map(bookmarkCategoryRowToDomain)
    .sort((a, b) =>
      a.columnIndex !== b.columnIndex ? a.columnIndex - b.columnIndex : a.orderIndex - b.orderIndex,
    );
}

export function useBookmarkCategories() {
  return useQuery({ queryKey: QK.categories(), queryFn: fetchCategories });
}

export interface CreateCategoryInput {
  name: string;
  columnIndex?: number;
}

function pickShortestColumn(existing: BookmarkCategory[], totalColumns = 3): number {
  const counts = new Array(totalColumns).fill(0);
  for (const c of existing) if (c.columnIndex < totalColumns) counts[c.columnIndex]++;
  let minIdx = 0;
  for (let i = 1; i < totalColumns; i++) if (counts[i] < counts[minIdx]) minIdx = i;
  return minIdx;
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCategoryInput): Promise<BookmarkCategory> => {
      const existing = qc.getQueryData<BookmarkCategory[]>(QK.categories()) ?? [];
      const profile = qc.getQueryData<BookmarkProfile | null>(QK.profile());
      const totalColumns = profile?.columnCount ?? 3;
      const columnIndex =
        input.columnIndex !== undefined
          ? Math.max(0, Math.min(totalColumns - 1, input.columnIndex))
          : pickShortestColumn(existing, totalColumns);
      const sameColumn = existing.filter((c) => c.columnIndex === columnIndex);
      const nextIndex =
        sameColumn.length > 0 ? Math.max(...sameColumn.map((c) => c.orderIndex)) + 1 : 0;
      const row = await workspaceInsert<BookmarkCategoryRow>('bookmark_categories', {
        name: input.name,
        column_index: columnIndex,
        order_index: nextIndex,
        hidden_from_public: false,
      });
      return bookmarkCategoryRowToDomain(row);
    },
    ...optimisticList<BookmarkCategory[], CreateCategoryInput>(qc, QK.categories(), (old, input) => {
      const profile = qc.getQueryData<BookmarkProfile | null>(QK.profile());
      const totalColumns = profile?.columnCount ?? 3;
      const columnIndex =
        input.columnIndex !== undefined
          ? Math.max(0, Math.min(totalColumns - 1, input.columnIndex))
          : pickShortestColumn(old, totalColumns);
      const sameColumn = old.filter((c) => c.columnIndex === columnIndex);
      const nextIndex =
        sameColumn.length > 0 ? Math.max(...sameColumn.map((c) => c.orderIndex)) + 1 : 0;
      return [
        ...old,
        {
          id: 'temp_cat_' + Date.now(),
          userId: '',
          name: input.name,
          hiddenFromPublic: false,
          columnIndex,
          orderIndex: nextIndex,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }),
  });
}

export interface UpdateCategoryInput {
  id: string;
  name?: string;
  hiddenFromPublic?: boolean;
  columnIndex?: number;
  orderIndex?: number;
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCategoryInput): Promise<BookmarkCategory> => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.hiddenFromPublic !== undefined) patch.hidden_from_public = input.hiddenFromPublic;
      if (input.columnIndex !== undefined) patch.column_index = input.columnIndex;
      if (input.orderIndex !== undefined) patch.order_index = input.orderIndex;
      if (Object.keys(patch).length === 0) {
        const cached = qc
          .getQueryData<BookmarkCategory[]>(QK.categories())
          ?.find((c) => c.id === input.id);
        if (cached) return cached;
      }
      const row = await workspaceUpdate<BookmarkCategoryRow>(
        'bookmark_categories',
        input.id,
        patch,
      );
      return bookmarkCategoryRowToDomain(row);
    },
    onMutate: async (input: UpdateCategoryInput) => {
      await qc.cancelQueries({ queryKey: QK.categories() });
      const snapshot = qc.getQueryData<BookmarkCategory[]>(QK.categories());
      if (snapshot) {
        qc.setQueryData<BookmarkCategory[]>(QK.categories(), (old) =>
          (old ?? []).map((c) =>
            c.id === input.id
              ? {
                  ...c,
                  name: input.name ?? c.name,
                  hiddenFromPublic: input.hiddenFromPublic ?? c.hiddenFromPublic,
                  columnIndex: input.columnIndex ?? c.columnIndex,
                  orderIndex: input.orderIndex ?? c.orderIndex,
                  updatedAt: new Date().toISOString(),
                }
              : c,
          ),
        );
      }
      return { snapshot };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(QK.categories(), ctx.snapshot);
    },
    onSuccess: (server) => {
      // Preserve local orderIndex + columnIndex (may have pending drag changes).
      qc.setQueryData<BookmarkCategory[]>(QK.categories(), (old) =>
        (old ?? []).map((c) =>
          c.id === server.id
            ? {
                ...c,
                name: server.name,
                hiddenFromPublic: server.hiddenFromPublic,
                updatedAt: server.updatedAt,
              }
            : c,
        ),
      );
    },
    // No invalidate — see useUpdateBookmark note.
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await workspaceDelete('bookmark_categories', id);
    },
    ...optimisticList<BookmarkCategory[], string>(qc, QK.categories(), (old, id) =>
      old.filter((c) => c.id !== id),
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.items() });
    },
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      ordered: Array<{ id: string; orderIndex: number; columnIndex?: number }>,
    ) => {
      for (const { id, orderIndex, columnIndex } of ordered) {
        const patch: Record<string, unknown> = { order_index: orderIndex };
        if (columnIndex !== undefined) patch.column_index = columnIndex;
        await workspaceUpdate('bookmark_categories', id, patch);
      }
    },
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: QK.categories() });
      const previous = qc.getQueryData<BookmarkCategory[]>(QK.categories()) ?? [];
      const map = new Map(ordered.map((o) => [o.id, o]));
      qc.setQueryData<BookmarkCategory[]>(QK.categories(), (old) =>
        (old ?? [])
          .map((c) => {
            const patch = map.get(c.id);
            if (!patch) return c;
            return {
              ...c,
              orderIndex: patch.orderIndex,
              columnIndex: patch.columnIndex ?? c.columnIndex,
            };
          })
          .sort((a, b) =>
            a.columnIndex !== b.columnIndex
              ? a.columnIndex - b.columnIndex
              : a.orderIndex - b.orderIndex,
          ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(QK.categories(), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QK.categories() });
    },
  });
}

// ============================================================
// Bookmarks (items) — unchanged
// ============================================================

async function fetchBookmarks(): Promise<Bookmark[]> {
  const rows = await workspaceSelect<BookmarkRow>('bookmarks', {
    order: { column: 'order_index', ascending: true },
  });
  return rows.map(bookmarkRowToDomain);
}

export function useBookmarks() {
  return useQuery({ queryKey: QK.items(), queryFn: fetchBookmarks });
}

export interface CreateBookmarkInput {
  categoryId: string;
  url: string;
  title?: string;
  note?: string;
  faviconUrl?: string | null;
}

export function useCreateBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBookmarkInput): Promise<Bookmark> => {
      const existing = qc.getQueryData<Bookmark[]>(QK.items()) ?? [];
      const sameCatCount = existing.filter((b) => b.categoryId === input.categoryId).length;
      const row = await workspaceInsert<BookmarkRow>('bookmarks', {
        category_id: input.categoryId,
        url: input.url,
        title: input.title ?? '',
        note: input.note ?? null,
        favicon_url: input.faviconUrl ?? null,
        order_index: sameCatCount,
      });
      const bookmark = bookmarkRowToDomain(row);
      if (!input.title || !input.faviconUrl) {
        fetchBookmarkMeta(input.url)
          .then(async (meta) => {
            // Use conditional RPC: only fills title/favicon if still blank at DB level
            const args: Record<string, unknown> = { p_bookmark_id: bookmark.id };
            if (!input.title && meta.title) args.p_title = meta.title;
            if (!input.faviconUrl && meta.faviconUrl) args.p_favicon_url = meta.faviconUrl;
            if (!args.p_title && !args.p_favicon_url) return;
            await workspaceRpc('bookmark_enrich_meta', args);
            // Refetch single bookmark from cache (RPC may or may not have updated)
            qc.invalidateQueries({ queryKey: QK.items() });
          })
          .catch(() => {});
      }
      return bookmark;
    },
    ...optimisticList<Bookmark[], CreateBookmarkInput>(qc, QK.items(), (old, input) => {
      const sameCatCount = old.filter((b) => b.categoryId === input.categoryId).length;
      const now = new Date().toISOString();
      return [
        ...old,
        {
          id: 'temp_bm_' + Date.now(),
          userId: '',
          categoryId: input.categoryId,
          url: input.url,
          title: input.title ?? '',
          note: input.note ?? '',
          faviconUrl: input.faviconUrl ?? null,
          iconType: 'image',
          iconText: null,
          iconRounded: null,
          iconBackground: null,
          orderIndex: sameCatCount,
          createdAt: now,
          updatedAt: now,
        },
      ];
    }),
  });
}

export interface UpdateBookmarkInput {
  id: string;
  categoryId?: string;
  url?: string;
  title?: string;
  note?: string;
  faviconUrl?: string | null;
  iconType?: 'image' | 'text';
  iconText?: string | null;
  iconRounded?: boolean | null;
  iconBackground?: string | null;
  orderIndex?: number;
}

export function useUpdateBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateBookmarkInput): Promise<Bookmark> => {
      const patch: Record<string, unknown> = {};
      if (input.categoryId !== undefined) patch.category_id = input.categoryId;
      if (input.url !== undefined) patch.url = input.url;
      if (input.title !== undefined) patch.title = input.title;
      if (input.note !== undefined) patch.note = input.note.length > 0 ? input.note : null;
      if (input.faviconUrl !== undefined) patch.favicon_url = input.faviconUrl;
      if (input.iconType !== undefined) patch.icon_type = input.iconType;
      if (input.iconText !== undefined) patch.icon_text = input.iconText;
      if (input.iconRounded !== undefined) patch.icon_rounded = input.iconRounded;
      if (input.iconBackground !== undefined) patch.icon_background = input.iconBackground;
      if (input.orderIndex !== undefined) patch.order_index = input.orderIndex;
      if (Object.keys(patch).length === 0) {
        const cached = qc.getQueryData<Bookmark[]>(QK.items())?.find((b) => b.id === input.id);
        if (cached) return cached;
      }
      const row = await workspaceUpdate<BookmarkRow>('bookmarks', input.id, patch);
      return bookmarkRowToDomain(row);
    },
    onMutate: async (input: UpdateBookmarkInput) => {
      await qc.cancelQueries({ queryKey: QK.items() });
      const snapshot = qc.getQueryData<Bookmark[]>(QK.items());
      if (snapshot) {
        qc.setQueryData<Bookmark[]>(QK.items(), (old) =>
          (old ?? []).map((b) =>
            b.id === input.id
              ? {
                  ...b,
                  url: input.url ?? b.url,
                  title: input.title ?? b.title,
                  note: input.note ?? b.note,
                  faviconUrl:
                    input.faviconUrl !== undefined ? input.faviconUrl : b.faviconUrl,
                  iconType: input.iconType ?? b.iconType,
                  iconText: input.iconText !== undefined ? input.iconText : b.iconText,
                  iconRounded:
                    input.iconRounded !== undefined ? input.iconRounded : b.iconRounded,
                  iconBackground:
                    input.iconBackground !== undefined
                      ? input.iconBackground
                      : b.iconBackground,
                  categoryId: input.categoryId ?? b.categoryId,
                  orderIndex: input.orderIndex ?? b.orderIndex,
                  updatedAt: new Date().toISOString(),
                }
              : b,
          ),
        );
      }
      return { snapshot };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(QK.items(), ctx.snapshot);
    },
    onSuccess: (server) => {
      // Merge server-committed fields (title/url/note/favicon) into cache
      // BUT preserve local categoryId + orderIndex (may have pending drag changes in edit mode).
      qc.setQueryData<Bookmark[]>(QK.items(), (old) =>
        (old ?? []).map((b) =>
          b.id === server.id
            ? {
                ...b,
                url: server.url,
                title: server.title,
                note: server.note,
                faviconUrl: server.faviconUrl,
                iconType: server.iconType,
                iconText: server.iconText,
                iconRounded: server.iconRounded,
                iconBackground: server.iconBackground,
                updatedAt: server.updatedAt,
              }
            : b,
        ),
      );
    },
    // Note: intentionally NO onSettled/invalidate — refetch would wipe pending
    // drag reorder made locally in edit mode. Cache is consistent because
    // onSuccess merges server fields while preserving categoryId/orderIndex.
  });
}

export function useDeleteBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await workspaceDelete('bookmarks', id);
    },
    ...optimisticList<Bookmark[], string>(qc, QK.items(), (old, id) => old.filter((b) => b.id !== id)),
  });
}

export function useReorderBookmarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      ordered: Array<{ id: string; orderIndex: number; categoryId?: string }>,
    ) => {
      for (const item of ordered) {
        const patch: Record<string, unknown> = { order_index: item.orderIndex };
        if (item.categoryId) patch.category_id = item.categoryId;
        await workspaceUpdate('bookmarks', item.id, patch);
      }
    },
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: QK.items() });
      const previous = qc.getQueryData<Bookmark[]>(QK.items()) ?? [];
      const map = new Map(ordered.map((o) => [o.id, o]));
      qc.setQueryData<Bookmark[]>(QK.items(), (old) =>
        (old ?? []).map((b) => {
          const patch = map.get(b.id);
          if (!patch) return b;
          return { ...b, orderIndex: patch.orderIndex, categoryId: patch.categoryId ?? b.categoryId };
        }),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(QK.items(), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QK.items() });
    },
  });
}

// ============================================================
// CSS Presets
// ============================================================

async function fetchPresets(): Promise<BookmarkPreset[]> {
  const rows = await workspaceSelect<BookmarkPresetRow>('bookmark_css_presets', {
    order: { column: 'updated_at', ascending: false },
  });
  return rows.map(bookmarkPresetRowToDomain);
}

export function useBookmarkPresets() {
  return useQuery({ queryKey: QK.presets(), queryFn: fetchPresets });
}

export interface CreatePresetInput {
  name: string;
  css: string;
  snapshot?: BookmarkSettingsSnapshot | null; // null/undefined = css-only preset
}

export function useCreateBookmarkPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePresetInput): Promise<BookmarkPreset> => {
      const includes = !!input.snapshot;
      const row = await workspaceInsert<BookmarkPresetRow>('bookmark_css_presets', {
        name: input.name,
        css: input.css,
        includes_settings: includes,
        settings_snapshot: includes ? snapshotDomainToJson(input.snapshot!) : null,
      });
      return bookmarkPresetRowToDomain(row);
    },
    onSuccess: (created) => {
      qc.setQueryData<BookmarkPreset[]>(QK.presets(), (old) => [created, ...(old ?? [])]);
    },
  });
}

export interface UpdatePresetInput {
  id: string;
  name?: string;
  css?: string;
  snapshot?: BookmarkSettingsSnapshot | null; // pass to rewrite snapshot; undefined = keep as-is
  clearSnapshot?: boolean; // true = drop snapshot, set includes_settings=false
}

export function useUpdateBookmarkPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePresetInput): Promise<BookmarkPreset> => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.css !== undefined) patch.css = input.css;
      if (input.clearSnapshot) {
        patch.includes_settings = false;
        patch.settings_snapshot = null;
      } else if (input.snapshot) {
        patch.includes_settings = true;
        patch.settings_snapshot = snapshotDomainToJson(input.snapshot);
      }
      const row = await workspaceUpdate<BookmarkPresetRow>('bookmark_css_presets', input.id, patch);
      return bookmarkPresetRowToDomain(row);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: QK.presets() });
      const previous = qc.getQueryData<BookmarkPreset[]>(QK.presets());
      qc.setQueryData<BookmarkPreset[]>(QK.presets(), (old) =>
        (old ?? []).map((p) =>
          p.id === input.id
            ? {
                ...p,
                name: input.name ?? p.name,
                css: input.css ?? p.css,
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(QK.presets(), ctx.previous);
    },
    onSuccess: (server) => {
      qc.setQueryData<BookmarkPreset[]>(QK.presets(), (old) =>
        (old ?? []).map((p) => (p.id === server.id ? server : p)),
      );
    },
  });
}

export function useDeleteBookmarkPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await workspaceDelete('bookmark_css_presets', id);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK.presets() });
      const previous = qc.getQueryData<BookmarkPreset[]>(QK.presets());
      qc.setQueryData<BookmarkPreset[]>(QK.presets(), (old) =>
        (old ?? []).filter((p) => p.id !== id),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(QK.presets(), ctx.previous);
    },
    onSuccess: (_data, id) => {
      // If deleted preset was active on profile, DB FK sets active_preset_id NULL.
      // Sync cache to reflect.
      const profile = qc.getQueryData<BookmarkProfile | null>(QK.profile());
      if (profile && profile.activePresetId === id) {
        qc.setQueryData<BookmarkProfile>(QK.profile(), { ...profile, activePresetId: null });
      }
    },
  });
}
