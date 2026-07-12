// ============================================================
// Agency Studio — Templates API (TanStack Query)
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';

export interface Template {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreateInput {
  name: string;
  subject: string;
  body: string;
  category?: string;
}

export interface TemplateUpdateInput extends Partial<TemplateCreateInput> {
  id: string;
}

export const templateKeys = {
  all: ['templates'] as const,
  list: () => ['templates', 'list'] as const,
  detail: (id: string) => ['templates', 'detail', id] as const,
};

export function useTemplatesQuery() {
  return useQuery({
    queryKey: templateKeys.list(),
    queryFn: async () => {
      const { data, error } = await authClient
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Template[];
    },
    staleTime: 60_000,
  });
}

export function useTemplateQuery(id: string) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await authClient
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return data as Template;
    },
    enabled: Boolean(id),
  });
}

export function useCreateTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TemplateCreateInput) => {
      const { data, error } = await authClient
        .from('templates')
        .insert(input)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Template;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: templateKeys.all }),
  });
}

export function useUpdateTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: TemplateUpdateInput) => {
      const { data, error } = await authClient
        .from('templates')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Template;
    },
    onSuccess: (data) => {
      qc.setQueryData(templateKeys.detail(data.id), data);
      void qc.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

export function useDeleteTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient.from('templates').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: templateKeys.all }),
  });
}

export function useDuplicateTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: original, error: fetchErr } = await authClient
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr || !original) throw new Error(fetchErr?.message ?? 'Not found');

      const { data, error } = await authClient
        .from('templates')
        .insert({
          name: `${original.name} (Copy)`,
          subject: original.subject,
          body: original.body,
          category: original.category,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Template;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: templateKeys.all }),
  });
}

// ============================================================
// Helper: render template với lead data
// ============================================================
export interface TemplateVars {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  [key: string]: string | undefined;
}

export const SAMPLE_VARS: TemplateVars = {
  name: 'Nguyễn Văn A',
  email: 'nguyenvana@example.com',
  phone: '+84 912 345 678',
  company: 'Acme Corp',
  website: 'https://acme.com',
};

export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}