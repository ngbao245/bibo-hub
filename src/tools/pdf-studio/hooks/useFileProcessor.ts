// ============================================================
// PDF Studio — File processor hook
// ============================================================
// Validates files, detects scan type, adds to batch store.
// OCR: no longer blocks scan → editable. Sets ocrRequired flag.
// ============================================================

import { useCallback } from 'react';
import { usePdfStudioStore } from '../store';
import type { LocalJob } from '../store';
import {
  validateFileFormat,
  getDefaultOutput,
  isOcrRequired,
  validateBatchLimits,
  type BatchLimits,
} from '../lib/formats';
import { classifyPdf, isPdfEncrypted } from '../lib/scan-detect';
import { storeInput } from '../lib/idb-storage';

export function useFileProcessor(limits: BatchLimits) {
  const addJobs = usePdfStudioStore((s) => s.addJobs);
  const updateJob = usePdfStudioStore((s) => s.updateJob);
  const defaultOutputFormat = usePdfStudioStore((s) => s.defaultOutputFormat);

  const processFiles = useCallback(async (files: File[]) => {
    // Check batch limits
    validateBatchLimits(files, limits);

    // Build initial job entries
    const newJobs: LocalJob[] = files.map((file) => {
      const ext = validateFileFormat(file) ?? 'unknown';
      const isValid = ext !== 'unknown';
      const outputFormat = defaultOutputFormat ?? getDefaultOutput(ext);

      return {
        localId: crypto.randomUUID(),
        file,
        filename: file.name,
        inputFormat: ext,
        outputFormat,
        fileSize: file.size,
        status: isValid ? 'validating' : 'invalid',
        outputReady: false,
        retryCount: 0,
        ocrRequired: false,
      };
    });

    addJobs(newJobs);

    // Async: validate each file (scan detection + store input)
    for (const job of newJobs) {
      if (job.status === 'invalid') continue;

      try {
        // Store input blob in IndexedDB
        storeInput(job.localId, job.file).catch(() => {});

        // PDF scan detection
        if (job.inputFormat === 'pdf') {
          const encrypted = await isPdfEncrypted(job.file);
          if (encrypted) {
            updateJob(job.localId, {
              status: 'invalid',
              errorMessage: 'PDF có mật khẩu hoặc bị mã hoá — không thể chuyển đổi',
            });
            continue;
          }

          const scanType = await classifyPdf(job.file);
          const outputFormat = defaultOutputFormat ?? getDefaultOutput('pdf', scanType);
          const needsOcr = isOcrRequired('pdf', outputFormat, scanType);

          updateJob(job.localId, {
            scanType,
            outputFormat,
            ocrRequired: needsOcr,
            status: 'pending',
            stages: needsOcr
              ? [
                  { name: 'Detect', status: 'done' },
                  { name: 'OCR (Auto)', status: 'pending' },
                  { name: 'Chuyển đổi', status: 'pending' },
                ]
              : undefined,
          });
        } else {
          updateJob(job.localId, { status: 'pending' });
        }
      } catch {
        updateJob(job.localId, { status: 'pending' });
      }
    }
  }, [addJobs, updateJob, defaultOutputFormat, limits]);

  return { processFiles };
}
