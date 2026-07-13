// ============================================================
// Roles API — CRUD role templates
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  allowed_tools: string[];
  created_at: string;
  updated_at: string;
}

export function useRolesQuery() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async (): Promise<Role[]> => {
      const { data, error } = await authClient
        .from('roles')
        .select('*')
        .order('name');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; allowed_tools: string[] }) => {
      const { data, error } = await authClient
        .from('roles')
        .insert(input)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Role;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useUpdateRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string | null; allowed_tools?: string[] }) => {
      const { id, ...rest } = input;
      const { data, error } = await authClient
        .from('roles')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Role;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useDeleteRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient
        .from('roles')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}