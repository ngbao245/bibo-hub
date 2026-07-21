// ============================================================
// Library Storage Pool — TanStack Query hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';
import { loadStorageNodes, clearClientCache } from './lib/pool';
import type { StorageNode } from './types';

// ── Query: Load all storage nodes ──

export function useStorageNodes() {
  return useQuery<StorageNode[]>({
    queryKey: ['library', 'storage-nodes'],
    queryFn: loadStorageNodes,
    staleTime: 60_000,
  });
}

// ── Mutation: Add new storage node ──

interface AddNodeInput {
  name: string;
  url: string;
  serviceRoleKey: string;
  anonKey: string;
  bucketName?: string;
  capacityBytes?: number;
}

export function useAddStorageNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddNodeInput) => {
      // 1. Find or create profile for library/storage.files
      let profileId: string;

      const { data: bindings } = await authClient
        .from('tool_service_bindings')
        .select('profile_id')
        .eq('tool_code', 'library')
        .eq('capability', 'storage.files')
        .eq('enabled', true)
        .limit(1);

      if (bindings?.length && bindings[0].profile_id) {
        profileId = bindings[0].profile_id;
      } else {
        // Find or create 'supabase_storage' provider
        let providerId: string;
        const { data: providers } = await authClient
          .from('service_providers')
          .select('id')
          .eq('code', 'supabase_storage')
          .limit(1);

        if (providers?.length) {
          providerId = providers[0].id;
        } else {
          const { data: newProvider, error: provErr } = await authClient
            .from('service_providers')
            .insert({ code: 'supabase_storage', name: 'Supabase Storage', category: 'storage' })
            .select('id')
            .single();
          if (provErr || !newProvider) throw new Error(`Failed to create provider: ${provErr?.message}`);
          providerId = newProvider.id;
        }

        // Create service profile
        const { data: profile, error: profileErr } = await authClient
          .from('service_profiles')
          .insert({ provider_id: providerId, name: 'Library Storage Pool' })
          .select('id')
          .single();
        if (profileErr || !profile) throw new Error(`Failed to create profile: ${profileErr?.message}`);
        profileId = profile.id;

        // Create binding
        await authClient
          .from('tool_service_bindings')
          .insert({
            tool_code: 'library',
            capability: 'storage.files',
            profile_id: profileId,
            enabled: true,
            priority: 0,
          });
      }

      // 2. Insert credential
      const { data, error } = await authClient
        .from('service_credentials')
        .insert({
          profile_id: profileId,
          credential_kind: 'api_key',
          name: input.name,
          identifier: input.url,
          secret_data_json: {
            url: input.url,
            service_role_key: input.serviceRoleKey,
            anon_key: input.anonKey,
            bucket_name: input.bucketName || 'books',
          },
          status: 'active',
          priority: 0,
          weight: 1,
          storage_capacity_bytes: input.capacityBytes ?? 1073741824,
          storage_used_bytes: 0,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to add node: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      clearClientCache();
      qc.invalidateQueries({ queryKey: ['library', 'storage-nodes'] });
    },
  });
}

// ── Mutation: Update storage node (name, status, capacity) ──

interface UpdateNodeInput {
  id: string;
  name?: string;
  status?: 'active' | 'disabled';
  capacityBytes?: number;
}

export function useUpdateStorageNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateNodeInput) => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.status !== undefined) patch.status = input.status;
      if (input.capacityBytes !== undefined) patch.storage_capacity_bytes = input.capacityBytes;

      const { error } = await authClient
        .from('service_credentials')
        .update(patch)
        .eq('id', input.id);

      if (error) throw new Error(`Failed to update node: ${error.message}`);
    },
    onSuccess: () => {
      clearClientCache();
      qc.invalidateQueries({ queryKey: ['library', 'storage-nodes'] });
    },
  });
}

// ── Mutation: Remove (delete) storage node credential ──

export function useRemoveStorageNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient
        .from('service_credentials')
        .delete()
        .eq('id', id);

      if (error) throw new Error(`Failed to remove node: ${error.message}`);
    },
    onSuccess: () => {
      clearClientCache();
      qc.invalidateQueries({ queryKey: ['library', 'storage-nodes'] });
    },
  });
}

// ── Mutation: Test node connection ──

export function useTestStorageNode() {
  return useMutation({
    mutationFn: async (node: { url: string; serviceRoleKey: string; bucketName: string }) => {
      // Try listing files in bucket to verify connection
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(node.url, node.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error } = await client.storage
        .from(node.bucketName || 'books')
        .list('', { limit: 1 });

      if (error) throw new Error(`Connection failed: ${error.message}`);
      return true;
    },
  });
}