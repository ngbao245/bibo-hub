// ============================================================
// workspace-proxy — Edge Function
// ============================================================
// Verify JWT from Core project using shared ES256 public key,
// then proxy CRUD operations to workspace DB via service_role.
//
// Why: Supabase hosted PostgREST requires kid match in JWKS.
// Core and Workspace have different kids for same key pair.
// This function bypasses that by verifying JWT manually.
//
// Frontend sends:
//   POST /functions/v1/workspace-proxy
//   Headers: Authorization: Bearer <core-jwt>
//   Body: { table, action, data?, filters?, order?, limit? }
//
// Function verifies JWT → extracts user_id → performs DB operation
// with service_role (bypass RLS) + manual user_id filter.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { importSPKI, jwtVerify } from 'https://deno.land/x/jose@v5.2.3/index.ts';

// ── Config ──

const WORKSPACE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Shared ES256 public key (PEM format derived from JWK)
// JWK: x="526-auliBc_ZCGUmtU9UvHTrInDRkKy5s_bvYjhOWp4", y="R0UK6dfnHRz8VGfVrQMbhI9BUW47XFqwT4e6rlmLqts"
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE526+auliBc/ZCGUmtU9UvHTrInDR
kKy5s/bvYjhOWp5HRQrp1+cdHPxUZ9WtAxuEj0FRbjtcWrBPh7quWYuq2w==
-----END PUBLIC KEY-----`;

// ── Types ──

interface ProxyRequest {
  table: 'notes' | 'tasks' | 'task_lists' | 'bookmarks' | 'vault_meta' | 'vault_entries' | 'highlights' | 'reading_progress';
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  data?: Record<string, unknown> | Record<string, unknown>[];
  filters?: Record<string, unknown>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  single?: boolean;
  onConflict?: string;
}

// ── CORS ──

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Handler ──

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // 1. Extract + verify JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  let userId: string;

  try {
    const publicKey = await importSPKI(PUBLIC_KEY_PEM, 'ES256');
    // Verify signature only — skip kid check (that's the whole point)
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['ES256'],
    });
    userId = payload.sub as string;
    if (!userId) {
      return json({ error: 'JWT missing sub claim' }, 401);
    }
  } catch (err) {
    return json({ error: `JWT verification failed: ${(err as Error).message}` }, 401);
  }

  // 2. Parse request body
  let body: ProxyRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { table, action, data, filters, order, limit, single, onConflict } = body;

  // Validate table name (whitelist)
  const ALLOWED_TABLES = ['notes', 'tasks', 'task_lists', 'bookmarks', 'vault_meta', 'vault_entries', 'highlights', 'reading_progress'];
  if (!ALLOWED_TABLES.includes(table)) {
    return json({ error: `Table "${table}" not allowed` }, 400);
  }

  // 3. Create service_role client
  const supabase = createClient(WORKSPACE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let result: { data: unknown; error: unknown };

    switch (action) {
      case 'select': {
        let query = supabase.from(table).select('*').eq('user_id', userId);
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            if (value === null) query = query.is(key, null);
            else query = query.eq(key, value as string);
          }
        }
        if (order) query = query.order(order.column, { ascending: order.ascending ?? false });
        if (limit) query = query.limit(limit);
        result = await query;
        break;
      }

      case 'insert': {
        if (!data) return json({ error: 'Missing data for insert' }, 400);
        // Inject user_id
        const rows = Array.isArray(data)
          ? data.map((r) => ({ ...r, user_id: userId }))
          : { ...data, user_id: userId };
        let query = supabase.from(table).insert(rows).select();
        if (single) query = query.single();
        result = await query;
        break;
      }

      case 'update': {
        if (!data || !filters?.id) return json({ error: 'Missing data or filters.id for update' }, 400);
        // Ensure user can only update own rows
        let query = supabase
          .from(table)
          .update(data as Record<string, unknown>)
          .eq('id', filters.id as string)
          .eq('user_id', userId)
          .select();
        if (single) query = query.single();
        result = await query;
        break;
      }

      case 'delete': {
        if (!filters?.id) return json({ error: 'Missing filters.id for delete' }, 400);
        // Support single id or array of ids
        const ids = filters.id;
        if (Array.isArray(ids)) {
          result = await supabase
            .from(table)
            .delete()
            .in('id', ids)
            .eq('user_id', userId);
        } else {
          result = await supabase
            .from(table)
            .delete()
            .eq('id', ids as string)
            .eq('user_id', userId);
        }
        break;
      }

      case 'upsert': {
        if (!data) return json({ error: 'Missing data for upsert' }, 400);
        const upsertRow = Array.isArray(data)
          ? data.map((r) => ({ ...r, user_id: userId }))
          : { ...data, user_id: userId };
        const conflictCols = onConflict ?? 'user_id';
        let query = supabase.from(table).upsert(upsertRow, { onConflict: conflictCols }).select();
        if (single) query = query.single();
        result = await query;
        break;
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }

    if (result.error) {
      return json({ error: (result.error as { message: string }).message }, 500);
    }

    return json({ data: result.data });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

// ── Helpers ──

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}