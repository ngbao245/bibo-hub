// ============================================================
// Core SDK — Datasource client factory + hook
// ============================================================
// Resolves tool_code → datasource → cached Supabase/MockAPI client.
//
// Fallback strategy:
//   1. Query DB (datasources table) for connection_json
//   2. If connection_json empty → fallback to env vars (VITE_SUPABASE_*)
//   3. If no env vars → throw (tool cannot function without backend)
//
// This allows gradual migration: tools work before connection_json is filled.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import type { Datasource, SupabaseConnection, ToolWithDatasource } from './types';

// ─── Client cache (singleton per datasource code) ───────────

const clientCache = new Map<string, SupabaseClient>();

/**
 * Get or create a Supabase client for a given datasource.
 * Clients are cached by datasource code — same code always returns same instance.
 */
function getOrCreateClient(datasource: Datasource): SupabaseClient {
  const cached = clientCache.get(datasource.code);
  if (cached) return cached;

  if (datasource.driver !== 'supabase') {
    throw new Error(
      `[core-sdk] Datasource "${datasource.code}" has driver "${datasource.driver}", not supabase.`,
    );
  }

  const conn = datasource.connection_json as SupabaseConnection;

  if (!conn.url || !conn.anon_key) {
    // Fallback: if this IS the core datasource, use authClient directly
    if (datasource.code === 'core') {
      clientCache.set(datasource.code, authClient);
      return authClient;
    }

    // Fallback: check env vars for known datasources
    const envClient = tryEnvFallback(datasource.code);
    if (envClient) {
      clientCache.set(datasource.code, envClient);
      return envClient;
    }

    throw new Error(
      `[core-sdk] Datasource "${datasource.code}" has empty connection_json and no env fallback.`,
    );
  }

  const client = createClient(conn.url, conn.anon_key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  clientCache.set(datasource.code, client);
  return client;
}

/**
 * Try to create client from env vars for known datasources.
 * Maps datasource codes to their VITE_* env var prefixes.
 */
function tryEnvFallback(code: string): SupabaseClient | null {
  const envMap: Record<string, { urlKey: string; keyKey: string }> = {
    core: {
      urlKey: 'VITE_SUPABASE_AUTH_URL',
      keyKey: 'VITE_SUPABASE_AUTH_ANON_KEY',
    },
    library: {
      urlKey: 'VITE_SUPABASE_READER_URL',
      keyKey: 'VITE_SUPABASE_READER_ANON_KEY',
    },
  };

  const mapping = envMap[code];
  if (!mapping) return null;

  const url = import.meta.env[mapping.urlKey] as string | undefined;
  const anonKey = import.meta.env[mapping.keyKey] as string | undefined;

  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Invalidate cached client for a datasource (e.g. when connection_json changes).
 */
export function invalidateClientCache(datasourceCode: string): void {
  clientCache.delete(datasourceCode);
}

// ─── Query: resolve tool → datasource ───────────────────────

async function fetchToolWithDatasource(toolCode: string): Promise<ToolWithDatasource> {
  // Query tools table, join datasource info via datasource_id
  const { data: tool, error: toolError } = await authClient
    .from('tools')
    .select('*')
    .eq('code', toolCode)
    .single();

  if (toolError || !tool) {
    throw new Error(`[core-sdk] Tool "${toolCode}" not found in DB: ${toolError?.message}`);
  }

  let datasource: Datasource | null = null;

  if (tool.datasource_id) {
    const { data: ds, error: dsError } = await authClient
      .from('datasources')
      .select('*')
      .eq('id', tool.datasource_id)
      .single();

    if (dsError) {
      throw new Error(
        `[core-sdk] Failed to load datasource for tool "${toolCode}": ${dsError.message}`,
      );
    }

    datasource = ds as Datasource;
  }

  return { ...tool, datasource } as ToolWithDatasource;
}

// ─── Hook: useDataSource ────────────────────────────────────

interface UseDataSourceResult {
  /** Supabase client for this tool's datasource. Null if tool has no backend. */
  client: SupabaseClient | null;
  /** The resolved datasource record. Null if tool has no backend. */
  datasource: Datasource | null;
  /** True while resolving datasource from DB. */
  isLoading: boolean;
  /** Error if resolution failed. */
  error: Error | null;
}

/**
 * Hook: resolves a tool's datasource and returns a cached Supabase client.
 *
 * @example
 * const { client, isLoading, error } = useDataSource('library');
 * if (isLoading) return <LoadingState variant="skeleton" count={4} />;
 * if (error) return <ErrorState message={error.message} />;
 * // client is ready to use
 * const { data } = await client.from('books').select('*');
 */
export function useDataSource(toolCode: string): UseDataSourceResult {
  const query = useQuery({
    queryKey: ['core-sdk', 'datasource', toolCode],
    queryFn: () => fetchToolWithDatasource(toolCode),
    staleTime: Infinity, // Datasource config rarely changes
    retry: 1,
  });

  if (query.isLoading || !query.data) {
    return { client: null, datasource: null, isLoading: true, error: null };
  }

  if (query.isError) {
    return {
      client: null,
      datasource: null,
      isLoading: false,
      error: query.error instanceof Error ? query.error : new Error(String(query.error)),
    };
  }

  const { datasource } = query.data;

  if (!datasource || datasource.driver === 'none') {
    return { client: null, datasource, isLoading: false, error: null };
  }

  if (datasource.status === 'disabled') {
    return {
      client: null,
      datasource,
      isLoading: false,
      error: new Error(`[core-sdk] Datasource "${datasource.code}" is disabled.`),
    };
  }

  try {
    const client = getOrCreateClient(datasource);
    return { client, datasource, isLoading: false, error: null };
  } catch (err) {
    return {
      client: null,
      datasource,
      isLoading: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

// ─── Query: all datasources (for admin UI) ──────────────────

export function useDatasources() {
  return useQuery({
    queryKey: ['core-sdk', 'datasources'],
    queryFn: async (): Promise<Datasource[]> => {
      const { data, error } = await authClient
        .from('datasources')
        .select('*')
        .order('code');
      if (error) throw new Error(error.message);
      return (data ?? []) as Datasource[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Imperative: get client without hook (for non-React code) ─

/**
 * Imperative client getter for use outside React components (e.g. in executor).
 * Fetches datasource from DB, returns cached client.
 * Throws if tool has no datasource or datasource is unavailable.
 */
export async function getClientForTool(toolCode: string): Promise<SupabaseClient> {
  const toolWithDs = await fetchToolWithDatasource(toolCode);

  if (!toolWithDs.datasource) {
    throw new Error(`[core-sdk] Tool "${toolCode}" has no datasource configured.`);
  }

  if (toolWithDs.datasource.status === 'disabled') {
    throw new Error(`[core-sdk] Datasource "${toolWithDs.datasource.code}" is disabled.`);
  }

  return getOrCreateClient(toolWithDs.datasource);
}