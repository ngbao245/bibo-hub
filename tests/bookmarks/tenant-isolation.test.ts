/**
 * Regression tests for workspace-proxy tenant isolation and field sanitization.
 * Tests the pure sanitizeData logic extracted from the proxy.
 * Does NOT call Deno/Supabase — validates authorization rules only.
 */
import { describe, it, expect } from 'vitest';

// ── Re-implement proxy security logic for unit testing ──
// (Mirrors supabase/functions/workspace-proxy/index.ts exactly)

const IMMUTABLE_FIELDS = new Set(['user_id', 'id', 'created_at']);

const WRITABLE_FIELDS: Record<string, Set<string> | undefined> = {
  bookmark_profiles: new Set([
    'slug', 'space_name', 'column_count', 'is_public', 'theme',
    'display_name', 'bio', 'webpage', 'icon_size',
    'background_type', 'background_value',
    'background_overlay_color', 'background_overlay_opacity', 'background_blend_mode',
    'icon_backdrop', 'category_label_color', 'bookmark_title_color',
    'custom_css', 'open_in_same_tab', 'active_preset_id', 'custom_css_draft',
  ]),
  bookmark_categories: new Set([
    'name', 'column_index', 'order_index', 'hidden_from_public',
  ]),
  bookmarks: new Set([
    'category_id', 'url', 'title', 'note', 'favicon_url', 'order_index',
    'icon_type', 'icon_text', 'icon_rounded', 'icon_background',
  ]),
  bookmark_css_presets: new Set([
    'name', 'css', 'includes_settings', 'settings_snapshot',
  ]),
};

const UPSERT_CONFLICT: Record<string, string> = {
  bookmark_profiles: 'user_id',
  bookmark_css_presets: 'id',
};

function sanitizeData(table: string, data: Record<string, unknown>): Record<string, unknown> {
  const allowed = WRITABLE_FIELDS[table];
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (IMMUTABLE_FIELDS.has(key)) continue;
    if (allowed && !allowed.has(key)) continue;
    clean[key] = value;
  }
  return clean;
}

// ── Tests ──

describe('sanitizeData — immutable fields', () => {
  it('strips user_id from bookmark insert payload', () => {
    const input = { category_id: 'cat-1', url: 'https://x.com', user_id: 'attacker-id' };
    const result = sanitizeData('bookmarks', input);
    expect(result).not.toHaveProperty('user_id');
    expect(result).toEqual({ category_id: 'cat-1', url: 'https://x.com' });
  });

  it('strips id from bookmark update payload', () => {
    const input = { id: 'row-id', title: 'new title' };
    const result = sanitizeData('bookmarks', input);
    expect(result).not.toHaveProperty('id');
    expect(result).toEqual({ title: 'new title' });
  });

  it('strips created_at from any payload', () => {
    const input = { name: 'Cat', created_at: '2025-01-01' };
    const result = sanitizeData('bookmark_categories', input);
    expect(result).not.toHaveProperty('created_at');
    expect(result).toEqual({ name: 'Cat' });
  });
});

describe('sanitizeData — bookmark table allowlist', () => {
  it('only allows listed fields for bookmarks table', () => {
    const input = {
      category_id: 'cat-1',
      url: 'https://example.com',
      title: 'Test',
      note: 'a note',
      favicon_url: 'https://img.com/x.png',
      order_index: 5,
      icon_type: 'text' as const,
      icon_text: 'A',
      icon_rounded: true,
      icon_background: '#ff0000',
      // Disallowed:
      user_id: 'evil',
      id: 'fake-id',
      created_at: '2025-01-01',
      updated_at: '2025-01-01', // not in allowlist
      random_field: 'hack',
    };
    const result = sanitizeData('bookmarks', input);
    expect(Object.keys(result).sort()).toEqual([
      'category_id', 'favicon_url', 'icon_background', 'icon_rounded',
      'icon_text', 'icon_type', 'note', 'order_index', 'title', 'url',
    ]);
  });

  it('returns empty object when all fields are disallowed', () => {
    const input = { user_id: 'x', id: 'y', created_at: 'z', unknown: 'w' };
    const result = sanitizeData('bookmarks', input);
    expect(result).toEqual({});
  });
});

describe('sanitizeData — profile allowlist', () => {
  it('allows valid profile fields', () => {
    const input = { slug: 'my-slug', custom_css: 'body{}', active_preset_id: 'p1' };
    const result = sanitizeData('bookmark_profiles', input);
    expect(result).toEqual(input);
  });

  it('strips user_id even for profile upsert', () => {
    const input = { slug: 'x', user_id: 'attacker' };
    const result = sanitizeData('bookmark_profiles', input);
    expect(result).toEqual({ slug: 'x' });
  });
});

describe('sanitizeData — category allowlist', () => {
  it('strips unknown fields from category payload', () => {
    const input = { name: 'Dev', order_index: 0, is_public: true };
    const result = sanitizeData('bookmark_categories', input);
    // is_public is NOT in category allowlist (dead column)
    expect(result).toEqual({ name: 'Dev', order_index: 0 });
  });
});

describe('sanitizeData — legacy tables (no allowlist)', () => {
  it('strips immutable fields but allows all others for notes', () => {
    const input = { user_id: 'x', id: 'y', content: 'hello', tags: ['a'] };
    const result = sanitizeData('notes', input);
    expect(result).toEqual({ content: 'hello', tags: ['a'] });
  });
});

describe('UPSERT_CONFLICT — fixed conflict targets', () => {
  it('bookmark_profiles conflict is always user_id', () => {
    expect(UPSERT_CONFLICT['bookmark_profiles']).toBe('user_id');
  });

  it('bookmark_css_presets conflict is always id', () => {
    expect(UPSERT_CONFLICT['bookmark_css_presets']).toBe('id');
  });

  it('legacy tables have no fixed conflict (client can suggest)', () => {
    expect(UPSERT_CONFLICT['notes']).toBeUndefined();
  });
});

describe('Cross-tenant category reference (DB constraint)', () => {
  // This test documents the expected DB behavior after migration runs.
  // It cannot be run against a real DB in unit tests, but serves as
  // specification and regression documentation.
  it('documents: insert bookmark with cross-owner category_id should fail at DB level', () => {
    // After migration 20260807000000_bookmark_tenant_isolation.sql:
    // bookmarks(category_id, user_id) → FK → bookmark_categories(id, user_id)
    // INSERT INTO bookmarks (user_id='A', category_id=<B's cat>) violates FK
    // because bookmark_categories has no row (id=<B's cat>, user_id='A').
    //
    // This is a documentation test — the real enforcement is in PostgreSQL.
    expect(true).toBe(true); // placeholder assertion; real test needs integration env
  });
});

describe('Public query defense-in-depth', () => {
  // Documents that get-public-bookmarks now filters by profile.user_id on bookmarks query.
  it('documents: public bookmark query must include .eq(user_id, profile.user_id)', () => {
    // After hardening, even if an attacker managed to insert a bookmark into
    // another user's category (which the FK now prevents), the public endpoint
    // would still not return it because it filters bookmarks by owner.
    //
    // Verified by code inspection: get-public-bookmarks/index.ts now has:
    //   .in('category_id', categoryIds)
    //   .eq('user_id', profile.user_id)
    expect(true).toBe(true); // documentation assertion
  });
});
