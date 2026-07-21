// ============================================================
// Workspace Proxy Client — gọi Edge Function thay vì PostgREST
// ============================================================
//
// Lý do: Supabase hosted PostgREST yêu cầu kid JWT match JWKS.
// Core và Workspace có kid khác nhau (cùng key pair nhưng Supabase
// tự gen kid). Edge Function verify JWT thủ công (ignore kid) rồi
// proxy DB operation qua service_role.
//
// Frontend gọi workspaceQuery/workspaceMutate thay vì supabase-js.
// ============================================================

import { useAuthStore } from '@/stores/authStore';

const WORKSPACE_URL =
  (import.meta.env.VITE_SUPABASE_WORKSPACE_URL as string | undefined) ??
  'https://bdxgxlfjcytdnojclgor.supabase.co';

const WORKSPACE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_WORKSPACE_ANON_KEY as string | undefined) ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkeGd4bGZqY3l0ZG5vamNsZ29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MjgxMjYsImV4cCI6MjEwMDAwNDEyNn0.L1VSo8ZYH_N_33gdcMPRJLQwFH1nYzH3IWIVESWdnXg';

const PROXY_URL = `${WORKSPACE_URL}/functions/v1/workspace-proxy`;

// ============================================================
// Types
// ============================================================

type AllowedTable = 'notes' | 'tasks' | 'task_lists' | 'bookmarks';

interface ProxyRequest {
  table: AllowedTable;
  action: 'select' | 'insert' | 'update' | 'delete';
  data?: Record<string, unknown> | Record<string, unknown>[];
  filters?: Record<string, unknown>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  single?: boolean;
}

interface ProxyResponse<T = unknown> {
  data: T;
  error: null;
}

// ============================================================
// Core fetch
// ============================================================

async function proxyFetch<T = unknown>(body: ProxyRequest): Promise<T> {
  const token = useAuthStore.getState().session?.access_token;
  if (!token) throw new Error('Chưa đăng nhập — không thể gọi workspace');

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: WORKSPACE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `Workspace proxy error: ${res.status}`);
  }

  const json = (await res.json()) as ProxyResponse<T>;
  return json.data;
}

// ============================================================
// Public API — mimic supabase-js interface nhưng qua proxy
// ============================================================

/** SELECT * FROM {table} WHERE user_id = current_user */
export async function workspaceSelect<T = unknown>(
  table: AllowedTable,
  options?: {
    filters?: Record<string, unknown>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
  },
): Promise<T[]> {
  return proxyFetch<T[]>({
    table,
    action: 'select',
    filters: options?.filters,
    order: options?.order,
    limit: options?.limit,
  });
}

/** INSERT INTO {table} ... RETURNING * */
export async function workspaceInsert<T = unknown>(
  table: AllowedTable,
  data: Record<string, unknown>,
): Promise<T> {
  return proxyFetch<T>({
    table,
    action: 'insert',
    data,
    single: true,
  });
}

/** UPDATE {table} SET ... WHERE id = X AND user_id = current_user RETURNING * */
export async function workspaceUpdate<T = unknown>(
  table: AllowedTable,
  id: string,
  data: Record<string, unknown>,
): Promise<T> {
  return proxyFetch<T>({
    table,
    action: 'update',
    data,
    filters: { id },
    single: true,
  });
}

/** DELETE FROM {table} WHERE id = X AND user_id = current_user */
export async function workspaceDelete(
  table: AllowedTable,
  id: string | string[],
): Promise<void> {
  await proxyFetch({
    table,
    action: 'delete',
    filters: { id },
  });
}