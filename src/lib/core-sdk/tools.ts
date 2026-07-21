// ============================================================
// Core SDK — Tools registry (TanStack Query hooks)
// ============================================================
// Query/mutate core.tools table (DB-backed tool registry).
// Complements the static TOOLS[] array in src/lib/tools.ts.
// Eventually TOOLS[] will be derived from this DB table.
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import type { EntityStatus, RequiredCapability, ToolRecord } from './types';

// ─── Query Keys ─────────────────────────────────────────────

export const toolKeys = {
  all: ['core-sdk', 'tools'] as const,
  byCode: (code: string) => ['core-sdk', 'tools', code] as const,
  active: ['core-sdk', 'tools', 'active'] as const,
};

// ─── Queries ────────────────────────────────────────────────

/**
 * Fetch all tools from DB.
 *
 * @example
 * const { data: tools } = useToolsRegistry();
 * // tools = [{ code: 'notes', name: 'Notes', datasource_id: '...', ... }]
 */
export function useToolsRegistry(status?: EntityStatus) {
  return useQuery({
    queryKey: status ? [...toolKeys.all, status] : toolKeys.all,
    queryFn: async (): Promise<ToolRecord[]> => {
      let q = authClient.from('tools').select('*');
      if (status) q = q.eq('status', status);
      q = q.order('name');
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as ToolRecord[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetch a single tool by code.
 */
export function useToolByCode(code: string) {
  return useQuery({
    queryKey: toolKeys.byCode(code),
    queryFn: async (): Promise<ToolRecord | null> => {
      const { data, error } = await authClient
        .from('tools')
        .select('*')
        .eq('code', code)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as ToolRecord) ?? null;
    },
    enabled: !!code,
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Mutations ──────────────────────────────────────────────

export interface CreateToolInput {
  code: string;
  name: string;
  description?: string;
  datasource_id?: string | null;
  required_capabilities?: RequiredCapability[];
  status?: EntityStatus;
}

export interface UpdateToolInput {
  id: string;
  name?: string;
  description?: string | null;
  datasource_id?: string | null;
  status?: EntityStatus;
}

/**
 * Register a new tool in DB.
 * If required_capabilities is provided, auto-creates bindings for each capability
 * using the preferred_provider's first active profile.
 */
export function useCreateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateToolInput): Promise<ToolRecord> => {
      const { required_capabilities, ...toolInput } = input;
      const payload = {
        ...toolInput,
        required_capabilities: required_capabilities ?? [],
      };

      const { data, error } = await authClient
        .from('tools')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      const tool = data as ToolRecord;

      // Auto-create bindings from required_capabilities
      if (required_capabilities && required_capabilities.length > 0) {
        await autoCreateBindings(tool.code, required_capabilities);
      }

      return tool;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: toolKeys.all });
      void qc.invalidateQueries({ queryKey: ['toolBindings'] });
    },
  });
}

/**
 * Update tool metadata (name, description, datasource, status).
 */
export function useUpdateTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateToolInput): Promise<ToolRecord> => {
      const { id, ...rest } = input;
      const { data, error } = await authClient
        .from('tools')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as ToolRecord;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: toolKeys.all });
      void qc.invalidateQueries({ queryKey: toolKeys.byCode(data.code) });
      // Invalidate datasource cache since tool→datasource mapping may have changed
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'datasource', data.code] });
    },
  });
}

/**
 * Disable a tool (soft delete — sets status to 'disabled').
 * Prefer this over hard delete to keep FK references intact.
 */
export function useDisableTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<void> => {
      const { error } = await authClient
        .from('tools')
        .update({ status: 'disabled' })
        .eq('code', code);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: toolKeys.all });
    },
  });
}

// ─── Auto-binding helper ────────────────────────────────────

/**
 * Auto-create tool_service_bindings from required_capabilities.
 * For each capability:
 *   1. Find provider by code (preferred_provider)
 *   2. Find first active profile for that provider
 *   3. INSERT binding (tool_code, capability, profile_id, is_primary=true)
 *   4. Skip if binding already exists (ON CONFLICT)
 */
async function autoCreateBindings(
  toolCode: string,
  capabilities: RequiredCapability[],
): Promise<void> {
  for (const cap of capabilities) {
    // Find provider
    const { data: provider } = await authClient
      .from('service_providers')
      .select('id')
      .eq('code', cap.preferred_provider)
      .eq('status', 'active')
      .maybeSingle();

    if (!provider) continue; // Provider not found, skip

    // Find first active profile for this provider
    const { data: profile } = await authClient
      .from('service_profiles')
      .select('id')
      .eq('provider_id', provider.id)
      .eq('status', 'active')
      .order('created_at')
      .limit(1)
      .maybeSingle();

    if (!profile) continue; // No active profile, skip

    // Insert binding (ignore if already exists)
    await authClient
      .from('tool_service_bindings')
      .insert({
        tool_code: toolCode,
        capability: cap.capability,
        profile_id: profile.id,
        is_primary: true,
        priority: 0,
        enabled: true,
      })
      .select('id')
      .maybeSingle(); // Ignore duplicate errors silently
  }
}

/**
 * Sync bindings for an existing tool based on its required_capabilities.
 * Useful when tool already exists but bindings are missing.
 * Only creates bindings that don't exist yet (won't override existing).
 */
export async function syncToolBindings(toolCode: string): Promise<void> {
  const { data: tool } = await authClient
    .from('tools')
    .select('required_capabilities')
    .eq('code', toolCode)
    .single();

  if (!tool) return;
  const caps = (tool.required_capabilities ?? []) as RequiredCapability[];
  if (caps.length === 0) return;

  await autoCreateBindings(toolCode, caps);
}