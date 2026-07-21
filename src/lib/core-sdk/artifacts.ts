// ============================================================
// Core SDK — Artifacts CRUD (TanStack Query hooks)
// ============================================================
// Query/mutate core.artifacts table.
// Used by admin UI to manage SQL migrations + edge functions.
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import type {
  Artifact,
  ArtifactKind,
  ArtifactStatus,
  CreateArtifactInput,
  UpdateArtifactInput,
} from './types';

// ─── Query Keys ─────────────────────────────────────────────

export const artifactKeys = {
  all: ['core-sdk', 'artifacts'] as const,
  byDatasource: (datasourceCode: string) =>
    ['core-sdk', 'artifacts', 'datasource', datasourceCode] as const,
  byKind: (kind: ArtifactKind) =>
    ['core-sdk', 'artifacts', 'kind', kind] as const,
  byName: (name: string) =>
    ['core-sdk', 'artifacts', 'name', name] as const,
  detail: (id: string) =>
    ['core-sdk', 'artifacts', 'detail', id] as const,
};

// ─── Queries ────────────────────────────────────────────────

interface ArtifactFilters {
  datasourceCode?: string;
  kind?: ArtifactKind;
  status?: ArtifactStatus;
}

/**
 * Fetch artifacts with optional filters.
 *
 * @example
 * // All migrations for library project
 * const { data } = useArtifacts({ datasourceCode: 'library', kind: 'migration' });
 *
 * @example
 * // All active edge functions
 * const { data } = useArtifacts({ kind: 'edge_function', status: 'latest' });
 */
export function useArtifacts(filters?: ArtifactFilters) {
  const { datasourceCode, kind, status } = filters ?? {};

  return useQuery({
    queryKey: [...artifactKeys.all, filters ?? {}],
    queryFn: async (): Promise<Artifact[]> => {
      let q = authClient.from('artifacts').select('*');

      if (datasourceCode) q = q.eq('datasource_code', datasourceCode);
      if (kind) q = q.eq('kind', kind);
      if (status) q = q.eq('status', status ?? 'active');

      q = q.order('name').order('version', { ascending: false });

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Artifact[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch single artifact by ID.
 */
export function useArtifact(id: string) {
  return useQuery({
    queryKey: artifactKeys.detail(id),
    queryFn: async (): Promise<Artifact> => {
      const { data, error } = await authClient
        .from('artifacts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return data as Artifact;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch latest version of an artifact by name + datasource.
 *
 * @example
 * const { data } = useLatestArtifact('send-campaign', 'email_crm');
 */
export function useLatestArtifact(name: string, datasourceCode: string) {
  return useQuery({
    queryKey: [...artifactKeys.byName(name), datasourceCode, 'latest'],
    queryFn: async (): Promise<Artifact | null> => {
      const { data, error } = await authClient
        .from('artifacts')
        .select('*')
        .eq('datasource_code', datasourceCode)
        .eq('name', name)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Artifact) ?? null;
    },
    enabled: !!name && !!datasourceCode,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mutations ──────────────────────────────────────────────

/**
 * Create a new artifact (or new version of existing).
 */
export function useCreateArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateArtifactInput): Promise<Artifact> => {
      const { data, error } = await authClient
        .from('artifacts')
        .insert(input)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Artifact;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: artifactKeys.all });
      void qc.invalidateQueries({
        queryKey: artifactKeys.byDatasource(data.datasource_code),
      });
    },
  });
}

/**
 * Update an existing artifact (content, status, metadata).
 */
export function useUpdateArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateArtifactInput): Promise<Artifact> => {
      const { id, ...rest } = input;
      const { data, error } = await authClient
        .from('artifacts')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Artifact;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: artifactKeys.all });
      void qc.invalidateQueries({ queryKey: artifactKeys.detail(data.id) });
    },
  });
}

/**
 * Delete an artifact permanently.
 * Prefer updating status to 'deprecated' over hard delete.
 */
export function useDeleteArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await authClient
        .from('artifacts')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: artifactKeys.all });
    },
  });
}