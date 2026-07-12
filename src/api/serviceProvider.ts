// ============================================================
// Service Provider API
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/library/supabase';
import type {
    ServiceProvider,
    ServiceProfile,
    ServiceCredential,
    ToolServiceBinding,
    ToolSettings,
} from '@/lib/service-provider/types';

// ============================================================
// Service Providers
// ============================================================

const PROVIDERS_KEY = ['service_providers'] as const;

async function fetchProviders(): Promise<ServiceProvider[]> {
    const { data, error } = await supabase
        .from('service_providers')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
}

export function useProviders() {
    return useQuery({
        queryKey: PROVIDERS_KEY,
        queryFn: fetchProviders,
    });
}

// ============================================================
// Service Profiles
// ============================================================

function profilesKey(providerId?: string) {
    return providerId ? ['service_profiles', providerId] : ['service_profiles'];
}

async function fetchProfiles(providerId?: string): Promise<ServiceProfile[]> {
    let query = supabase
        .from('service_profiles')
        .select('*')
        .order('name', { ascending: true });

    if (providerId) {
        query = query.eq('provider_id', providerId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
}

export function useProfiles(providerId?: string) {
    return useQuery({
        queryKey: profilesKey(providerId),
        queryFn: () => fetchProfiles(providerId),
    });
}

export function useCreateProfile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: Omit<ServiceProfile, 'id' | 'created_at' | 'updated_at'>) => {
            const { data, error } = await supabase
                .from('service_profiles')
                .insert(input)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: profilesKey(data.provider_id) });
            qc.invalidateQueries({ queryKey: profilesKey() });
        },
    });
}

export function useUpdateProfile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (profile: ServiceProfile) => {
            const { id, created_at, updated_at, ...payload } = profile;
            const { data, error } = await supabase
                .from('service_profiles')
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: profilesKey(data.provider_id) });
            qc.invalidateQueries({ queryKey: profilesKey() });
        },
    });
}

export function useDeleteProfile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('service_profiles').delete().eq('id', id);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: profilesKey() });
        },
    });
}

// ============================================================
// Service Credentials
// ============================================================

function credentialsKey(profileId?: string) {
    return profileId ? ['service_credentials', profileId] : ['service_credentials'];
}

async function fetchCredentials(profileId?: string): Promise<ServiceCredential[]> {
    let query = supabase
        .from('service_credentials')
        .select('*')
        .order('priority', { ascending: false });

    if (profileId) {
        query = query.eq('profile_id', profileId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
}

export function useCredentials(profileId?: string) {
    return useQuery({
        queryKey: credentialsKey(profileId),
        queryFn: () => fetchCredentials(profileId),
    });
}

export function useCreateCredential() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: Omit<ServiceCredential, 'id' | 'created_at' | 'updated_at'>) => {
            const { data, error } = await supabase
                .from('service_credentials')
                .insert(input)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: credentialsKey(data.profile_id) });
            qc.invalidateQueries({ queryKey: credentialsKey() });
        },
    });
}

export function useUpdateCredential() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (credential: ServiceCredential) => {
            const { id, created_at, updated_at, ...payload } = credential;
            const { data, error } = await supabase
                .from('service_credentials')
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: credentialsKey(data.profile_id) });
            qc.invalidateQueries({ queryKey: credentialsKey() });
        },
    });
}

export function useDeleteCredential() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('service_credentials').delete().eq('id', id);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: credentialsKey() });
        },
    });
}

// ============================================================
// Tool Service Bindings
// ============================================================

function bindingsKey(toolCode?: string) {
    return toolCode ? ['tool_service_bindings', toolCode] : ['tool_service_bindings'];
}

async function fetchBindings(toolCode?: string): Promise<ToolServiceBinding[]> {
    let query = supabase
        .from('tool_service_bindings')
        .select('*')
        .order('tool_code', { ascending: true })
        .order('priority', { ascending: true });

    if (toolCode) {
        query = query.eq('tool_code', toolCode);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
}

export function useBindings(toolCode?: string) {
    return useQuery({
        queryKey: bindingsKey(toolCode),
        queryFn: () => fetchBindings(toolCode),
    });
}

export function useCreateBinding() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: Omit<ToolServiceBinding, 'id' | 'created_at' | 'updated_at'>) => {
            const { data, error } = await supabase
                .from('tool_service_bindings')
                .insert(input)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: bindingsKey(data.tool_code) });
            qc.invalidateQueries({ queryKey: bindingsKey() });
        },
    });
}

export function useUpdateBinding() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (binding: ToolServiceBinding) => {
            const { id, created_at, updated_at, ...payload } = binding;
            const { data, error } = await supabase
                .from('tool_service_bindings')
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: bindingsKey(data.tool_code) });
            qc.invalidateQueries({ queryKey: bindingsKey() });
        },
    });
}

export function useDeleteBinding() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('tool_service_bindings').delete().eq('id', id);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bindingsKey() });
        },
    });
}

// ============================================================
// Tool Settings
// ============================================================

function toolSettingsKey(toolCode?: string) {
    return toolCode ? ['tool_settings', toolCode] : ['tool_settings'];
}

async function fetchToolSettings(toolCode: string): Promise<ToolSettings | null> {
    const { data, error } = await supabase
        .from('tool_settings')
        .select('*')
        .eq('tool_code', toolCode)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
}

export function useToolSettings(toolCode: string) {
    return useQuery({
        queryKey: toolSettingsKey(toolCode),
        queryFn: () => fetchToolSettings(toolCode),
    });
}

export function useUpdateToolSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: { tool_code: string; settings: Record<string, unknown> }) => {
            const { data, error } = await supabase
                .from('tool_settings')
                .upsert(
                    { tool_code: input.tool_code, settings: input.settings },
                    { onConflict: 'tool_code' },
                )
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: toolSettingsKey(data.tool_code) });
        },
    });
}
