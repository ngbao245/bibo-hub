// ============================================================
// PDF Studio — API hooks (TanStack Query + Edge Function)
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';
import type { PdfStudioBatch, PdfStudioJob, PdfStudioToolSettings } from '@/lib/pdf-studio/types';

// ─── Query Keys ─────────────────────────────────────────────

export const pdfKeys = {
  batches: ['pdfStudio', 'batches'] as const,
  batch: (id: string) => ['pdfStudio', 'batch', id] as const,
  jobs: (batchId: string) => ['pdfStudio', 'jobs', batchId] as const,
  settings: ['pdfStudio', 'settings'] as const,
};

// ─── Batches ────────────────────────────────────────────────

export function useBatchHistory() {
  return useQuery({
    queryKey: pdfKeys.batches,
    queryFn: async (): Promise<PdfStudioBatch[]> => {
      const { data, error } = await authClient
        .from('pdf_studio_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useBatchJobs(batchId: string | null) {
  return useQuery({
    queryKey: pdfKeys.jobs(batchId ?? ''),
    queryFn: async (): Promise<PdfStudioJob[]> => {
      if (!batchId) return [];
      const { data, error } = await authClient
        .from('pdf_studio_jobs')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!batchId,
    staleTime: 10_000,
  });
}

// ─── Create batch ───────────────────────────────────────────

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      default_output_format?: string;
      total_files: number;
      settings_json?: Record<string, unknown>;
    }): Promise<PdfStudioBatch> => {
      // Get current user ID
      const { data: { user } } = await authClient.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await authClient
        .from('pdf_studio_batches')
        .insert({
          user_id: user.id,
          default_output_format: input.default_output_format ?? null,
          total_files: input.total_files,
          settings_json: input.settings_json ?? {},
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pdfKeys.batches });
    },
  });
}

// ─── Create jobs ────────────────────────────────────────────

export function useCreateJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobs: Array<{
      batch_id: string;
      input_filename: string;
      input_format: string;
      input_size_bytes?: number;
      output_format: string;
      scan_classification?: string;
    }>): Promise<PdfStudioJob[]> => {
      const { data: { user } } = await authClient.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const jobsWithUser = jobs.map((j) => ({ ...j, user_id: user.id }));
      const { data, error } = await authClient
        .from('pdf_studio_jobs')
        .insert(jobsWithUser)
        .select('*');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        void qc.invalidateQueries({ queryKey: pdfKeys.jobs(variables[0].batch_id) });
      }
    },
  });
}

// ─── Update job status ──────────────────────────────────────

export function useUpdateJobStatus() {
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: string;
      provider_code?: string;
      provider_job_id?: string;
      provider_task_id?: string;
      credential_id?: string;
      output_filename?: string;
      output_size_bytes?: number;
      error_code?: string;
      error_message?: string;
      error_retryable?: boolean;
      started_at?: string;
      completed_at?: string;
    }): Promise<PdfStudioJob> => {
      const { id, ...fields } = input;
      const { data, error } = await authClient
        .from('pdf_studio_jobs')
        .update(fields)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

// ─── Update batch counters ──────────────────────────────────

export function useUpdateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status?: string;
      completed_files?: number;
      failed_files?: number;
    }): Promise<PdfStudioBatch> => {
      const { id, ...fields } = input;
      const { data, error } = await authClient
        .from('pdf_studio_batches')
        .update(fields)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pdfKeys.batches });
    },
  });
}

// ─── Tool settings ──────────────────────────────────────────

export function usePdfStudioSettings() {
  return useQuery({
    queryKey: pdfKeys.settings,
    queryFn: async (): Promise<PdfStudioToolSettings> => {
      const { data, error } = await authClient
        .from('tool_settings')
        .select('settings_json')
        .eq('tool_code', 'pdf_studio')
        .maybeSingle();
      if (error) throw new Error(error.message);
      const defaults: PdfStudioToolSettings = {
        max_files_per_batch: 10,
        max_file_size_mb: 50,
        max_batch_size_mb: 200,
        concurrency: 3,
        grace_period_minutes: 60,
        safety_retention_hours: 24,
      };
      return { ...defaults, ...(data?.settings_json as Partial<PdfStudioToolSettings> ?? {}) };
    },
    staleTime: 5 * 60 * 1000,
  });
}
