// ============================================================
// PDF Studio — Conversion queue hook
// ============================================================
// Manages concurrency-controlled conversion execution.
// Integrates with Zustand store for UI updates and
// TanStack Query API hooks for server persistence.
// ============================================================

import { useCallback, useRef, useEffect } from 'react';
import { usePdfStudioStore } from '../store';
import type { LocalJob } from '../store';
import { executeConversion } from '../lib/conversion-engine';
import { getInput } from '../lib/idb-storage';
import { useCreateBatch, useCreateJobs, useUpdateJobStatus } from '../api/pdf-studio-api';

export function useConversionQueue() {
  const {
    jobs,
    batchId,
    isRunning,
    concurrency,
    updateJob,
    setBatchId,
    setRunning,
  } = usePdfStudioStore();

  const createBatch = useCreateBatch();
  const createJobs = useCreateJobs();
  const updateJobStatus = useUpdateJobStatus();

  const activeCount = useRef(0);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  /** Track jobs already processed or in-flight to prevent re-pick */
  const processedIds = useRef<Set<string>>(new Set());

  const processNext = useCallback(async () => {
    // Read fresh state from store (not stale closure)
    const state = usePdfStudioStore.getState();
    if (!state.isRunning) return;
    if (activeCount.current >= state.concurrency) return;

    // Find first pending job not already processed
    const pendingJob = state.jobs.find(
      (j) => j.status === 'pending' && !processedIds.current.has(j.localId),
    );

    if (!pendingJob) {
      // Check if all done
      const allTerminal = state.jobs.every((j) =>
        ['ready', 'failed', 'cancelled', 'invalid', 'needs_file', 'warn_scan'].includes(j.status)
        || processedIds.current.has(j.localId),
      );
      if (allTerminal && state.jobs.length > 0) {
        usePdfStudioStore.getState().setRunning(false);
        processedIds.current.clear();
      }
      return;
    }

    // Mark as in-flight
    processedIds.current.add(pendingJob.localId);
    activeCount.current++;

    const controller = new AbortController();
    abortControllers.current.set(pendingJob.localId, controller);

    try {
      // Get file from IndexedDB or use in-memory reference
      let file = pendingJob.file;
      if (!file) {
        const stored = await getInput(pendingJob.localId);
        if (!stored) {
          updateJob(pendingJob.localId, { status: 'needs_file', errorMessage: 'File da mat, can chon lai' });
          return;
        }
        file = new File([stored.blob], stored.filename, { type: stored.mime });
      }

      // Update status to uploading
      updateJob(pendingJob.localId, {
        status: 'uploading',
        stages: pendingJob.ocrRequired
          ? [
              { name: 'Detect', status: 'done' },
              { name: 'OCR (Auto)', status: 'running' },
              { name: 'Chuyển đổi', status: 'pending' },
            ]
          : undefined,
      });

      // Execute conversion
      const result = await executeConversion(
        {
          jobId: pendingJob.jobId ?? pendingJob.localId,
          file,
          inputFormat: pendingJob.inputFormat,
          outputFormat: pendingJob.outputFormat,
          ocrRequired: pendingJob.ocrRequired,
        },
        (stage) => {
          const stageMap: Record<string, string> = {
            requesting: 'uploading',
            uploading: 'uploading',
            processing: 'processing',
            downloading: 'caching_result',
            caching: 'caching_result',
          };
          const newStatus = stageMap[stage] as LocalJob['status'];
          // Update stages for OCR jobs
          if (pendingJob.ocrRequired) {
            const stages = stage === 'processing'
              ? [
                  { name: 'Detect', status: 'done' as const },
                  { name: 'OCR (Auto)', status: 'done' as const },
                  { name: 'Chuyển đổi', status: 'running' as const },
                ]
              : stage === 'downloading' || stage === 'caching'
              ? [
                  { name: 'Detect', status: 'done' as const },
                  { name: 'OCR (Auto)', status: 'done' as const },
                  { name: 'Chuyển đổi', status: 'done' as const },
                ]
              : undefined;
            updateJob(pendingJob.localId, { status: newStatus, stages });
          } else {
            updateJob(pendingJob.localId, { status: newStatus });
          }
        },
        controller.signal,
      );

      if (result.success) {
        updateJob(pendingJob.localId, {
          status: 'ready',
          outputReady: true,
          outputFilename: result.outputFilename,
          outputSize: result.outputSize,
        });

        if (pendingJob.jobId) {
          updateJobStatus.mutate({
            id: pendingJob.jobId,
            status: 'ready',
            provider_code: result.providerCode,
            provider_job_id: result.providerJobId,
            credential_id: result.credentialId,
            output_filename: result.outputFilename,
            output_size_bytes: result.outputSize,
            completed_at: new Date().toISOString(),
          });
        }
      } else {
        updateJob(pendingJob.localId, {
          status: 'failed',
          errorMessage: result.error,
        });

        if (pendingJob.jobId) {
          updateJobStatus.mutate({
            id: pendingJob.jobId,
            status: 'failed',
            error_message: result.error,
            error_retryable: result.errorRetryable,
          });
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        updateJob(pendingJob.localId, { status: 'cancelled' });
      } else {
        updateJob(pendingJob.localId, {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    } finally {
      activeCount.current--;
      abortControllers.current.delete(pendingJob.localId);
      // Process next job (different job, not same one)
      processNext();
    }
  }, [updateJob, updateJobStatus]);

  // Start processing when isRunning changes to true
  useEffect(() => {
    if (!isRunning) return;

    const initBatch = async () => {
      // Reset processed tracker for new run
      processedIds.current.clear();

      if (!batchId) {
        const pendingJobs = jobs.filter((j) => j.status === 'pending');
        if (pendingJobs.length === 0) return;

        try {
          const batch = await createBatch.mutateAsync({
            total_files: jobs.length,
            default_output_format: usePdfStudioStore.getState().defaultOutputFormat ?? undefined,
          });
          setBatchId(batch.id);

          const jobInputs = pendingJobs.map((j) => ({
            batch_id: batch.id,
            input_filename: j.filename,
            input_format: j.inputFormat,
            input_size_bytes: j.fileSize,
            output_format: j.outputFormat,
            scan_classification: j.scanType ?? undefined,
          }));

          const serverJobs = await createJobs.mutateAsync(jobInputs);
          for (let i = 0; i < serverJobs.length; i++) {
            if (i < pendingJobs.length) {
              updateJob(pendingJobs[i].localId, { jobId: serverJobs[i].id });
            }
          }
        } catch {
          // Non-fatal: continue without server persistence
        }
      }

      // Start concurrent slots
      for (let i = 0; i < concurrency; i++) {
        processNext();
      }
    };

    initBatch();
  }, [isRunning]);

  // Stop: abort active conversions
  const stopAll = useCallback(() => {
    for (const [, controller] of abortControllers.current) {
      controller.abort();
    }
    abortControllers.current.clear();
    activeCount.current = 0;
    processedIds.current.clear();
    setRunning(false);
  }, [setRunning]);

  return { processNext, stopAll };
}
