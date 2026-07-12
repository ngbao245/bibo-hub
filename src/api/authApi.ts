// ============================================================
// authApi — profiles + user management hooks
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient, AUTH_FUNCTIONS_URL } from '@/lib/authClient';
import { useAuthStore, type Profile, type UserRole } from '@/stores/authStore';

// ============================================================
// Users list (admin only)
// ============================================================

/** Profile join với email từ auth.users. Admin thấy list này. */
export interface AdminUserRow extends Profile {
  email: string | null;
}

async function fetchUsersList(): Promise<AdminUserRow[]> {
  // Query profiles đủ dùng cho UI. Email không lấy từ auth.users vì client-side
  // không truy vấn được — nếu cần email, dùng Edge Function riêng.
  const { data, error } = await authClient
    .from('profiles')
    .select('id, role, allowed_tools, created_at, username, avatar_url')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role as UserRole,
    allowed_tools: row.allowed_tools ?? [],
    created_at: row.created_at,
    username: row.username ?? null,
    avatar_url: row.avatar_url ?? null,
    email: null,
  }));
}

export function useUsersQuery() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsersList,
    staleTime: 30 * 1000,
  });
}

// ============================================================
// Update permission (admin edit allowed_tools + role)
// ============================================================

export interface UpdatePermissionInput {
  userId: string;
  role: UserRole;
  allowed_tools: string[];
}

export function useUpdatePermissionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePermissionInput) => {
      const { error } = await authClient
        .from('profiles')
        .update({ role: input.role, allowed_tools: input.allowed_tools })
        .eq('id', input.userId);
      if (error) throw new Error(error.message);
      return input;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// ============================================================
// Create user (call Edge Function)
// ============================================================

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  allowed_tools: string[];
}

async function callEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  const session = useAuthStore.getState().session;
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${AUTH_FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      return callEdgeFunction<{ ok: true; user: { id: string; email: string; username: string } }>(
        'create-user',
        input,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// ============================================================
// Delete user (call Edge Function)
// ============================================================

export function useDeleteUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      return callEdgeFunction<{ ok: true }>('delete-user', { user_id: userId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}