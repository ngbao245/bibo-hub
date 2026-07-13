// ============================================================
// Service Registry API — TanStack Query hooks for CRUD
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';
import type {
  ServiceProvider,
  ServiceProfile,
  ServiceCredential,
  ToolServiceBinding,
  ToolSettings,
  CreateProfileInput,
  UpdateProfileInput,
  CreateCredentialInput,
  UpdateCredentialInput,
  CreateBindingInput,
  UpdateBindingInput,
  UpdateToolSettingsInput,
} from '@/lib/service-registry/types';

// ─── Query Keys ─────────────────────────────────────────────

export const srKeys = {
  providers: ['serviceProviders'] as const,
  profiles: (providerId?: string) =>
    providerId ? ['serviceProfiles', providerId] as const : ['serviceProfiles'] as const,
  credentials: (profileId: string) => ['serviceCredentials', profileId] as const,
  bindings: (toolCode?: string) =>
    toolCode ? ['toolBindings', toolCode] as const : ['toolBindings'] as const,
  bindingsByProfile: (profileId: string) => ['toolBindingsByProfile', profileId] as const,
  toolSettings: (toolCode: string) => ['toolSettings', toolCode] as const,
};

// ─── Providers ──────────────────────────────────────────────

export function useServiceProviders() {
  return useQuery({
    queryKey: srKeys.providers,
    queryFn: async (): Promise<ServiceProvider[]> => {
      const { data, error } = await authClient
        .from('service_providers')
        .select('*')
        .order('name');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Profiles ───────────────────────────────────────────────

export function useServiceProfiles(providerId?: string) {
  return useQuery({
    queryKey: srKeys.profiles(providerId),
    queryFn: async (): Promise<ServiceProfile[]> => {
      let q = authClient.from('service_profiles').select('*');
      if (providerId) q = q.eq('provider_id', providerId);
      q = q.order('created_at');
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProfileInput): Promise<ServiceProfile> => {
      const { data, error } = await authClient
        .from('service_profiles')
        .insert(input)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: srKeys.profiles(data.provider_id) });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<ServiceProfile> => {
      const { id, ...rest } = input;
      const { data, error } = await authClient
        .from('service_profiles')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: srKeys.profiles(data.provider_id) });
    },
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await authClient
        .from('service_profiles')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['serviceProfiles'] });
      void qc.invalidateQueries({ queryKey: ['serviceCredentials'] });
      void qc.invalidateQueries({ queryKey: ['toolBindings'] });
    },
  });
}

// ─── Credentials ────────────────────────────────────────────

export function useServiceCredentials(profileId: string) {
  return useQuery({
    queryKey: srKeys.credentials(profileId),
    queryFn: async (): Promise<ServiceCredential[]> => {
      const { data, error } = await authClient
        .from('service_credentials')
        .select('*')
        .eq('profile_id', profileId)
        .order('priority');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!profileId,
  });
}

export function useCreateCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCredentialInput): Promise<ServiceCredential> => {
      const { data, error } = await authClient
        .from('service_credentials')
        .insert(input)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: srKeys.credentials(data.profile_id) });
    },
  });
}

export function useUpdateCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCredentialInput): Promise<ServiceCredential> => {
      const { id, ...rest } = input;
      const { data, error } = await authClient
        .from('service_credentials')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: srKeys.credentials(data.profile_id) });
    },
  });
}

export function useDeleteCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, profileId }: { id: string; profileId: string }): Promise<void> => {
      const { error } = await authClient
        .from('service_credentials')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
      void qc.invalidateQueries({ queryKey: srKeys.credentials(profileId) });
    },
  });
}

// ─── Bindings ───────────────────────────────────────────────

export function useToolBindings(toolCode?: string) {
  return useQuery({
    queryKey: srKeys.bindings(toolCode),
    queryFn: async (): Promise<ToolServiceBinding[]> => {
      let q = authClient.from('tool_service_bindings').select('*');
      if (toolCode) q = q.eq('tool_code', toolCode);
      q = q.order('priority');
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useToolBindingsByProfile(profileId: string) {
  return useQuery({
    queryKey: srKeys.bindingsByProfile(profileId),
    queryFn: async (): Promise<ToolServiceBinding[]> => {
      const { data, error } = await authClient
        .from('tool_service_bindings')
        .select('*')
        .eq('profile_id', profileId)
        .order('priority');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!profileId,
  });
}

export function useCreateBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBindingInput): Promise<ToolServiceBinding> => {
      const { data, error } = await authClient
        .from('tool_service_bindings')
        .insert(input)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['toolBindings'] });
      void qc.invalidateQueries({ queryKey: ['toolBindingsByProfile'] });
    },
  });
}

export function useUpdateBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateBindingInput): Promise<ToolServiceBinding> => {
      const { id, ...rest } = input;
      const { data, error } = await authClient
        .from('tool_service_bindings')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['toolBindings'] });
      void qc.invalidateQueries({ queryKey: ['toolBindingsByProfile'] });
    },
  });
}

export function useDeleteBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await authClient
        .from('tool_service_bindings')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['toolBindings'] });
      void qc.invalidateQueries({ queryKey: ['toolBindingsByProfile'] });
    },
  });
}

// ─── Tool Settings ──────────────────────────────────────────

export function useToolSettings(toolCode: string) {
  return useQuery({
    queryKey: srKeys.toolSettings(toolCode),
    queryFn: async (): Promise<ToolSettings | null> => {
      const { data, error } = await authClient
        .from('tool_settings')
        .select('*')
        .eq('tool_code', toolCode)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!toolCode,
  });
}

export function useUpdateToolSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateToolSettingsInput): Promise<ToolSettings> => {
      const { data, error } = await authClient
        .from('tool_settings')
        .upsert(
          { tool_code: input.tool_code, settings_json: input.settings_json },
          { onConflict: 'tool_code' },
        )
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: srKeys.toolSettings(data.tool_code) });
    },
  });
}