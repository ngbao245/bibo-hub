// ============================================================
// PDF Studio — Conversion engine (orchestration)
// ============================================================
// Manages the lifecycle of a conversion job:
//   1. Request credential descriptor from Edge Function
//   2. Upload file to provider (direct upload with descriptor)
//   3. Poll provider for completion
//   4. Cache output in IndexedDB
//   5. Update job status
//
// Runs in browser, one job at a time per concurrency slot.
// ============================================================

import { serverExecutor } from '@/lib/service-registry/server-executor';
import type { IlovepdfDescriptor, CloudConvertDescriptor } from '@/lib/service-registry/server-executor';
import { storeOutput } from './idb-storage';
import { findRoute } from './formats';
import type { OutputFormat } from '@/lib/pdf-studio/types';

export interface ConversionInput {
  jobId: string;
  file: File;
  inputFormat: string;
  outputFormat: OutputFormat;
  ocrRequired?: boolean;
}

export interface ConversionResult {
  success: boolean;
  providerCode?: string;
  credentialId?: string;
  providerJobId?: string;
  outputBlob?: Blob;
  outputFilename?: string;
  outputSize?: number;
  error?: string;
  errorRetryable?: boolean;
}

export type ProgressCallback = (stage: 'requesting' | 'uploading' | 'processing' | 'downloading' | 'caching') => void;

/**
 * Execute a single conversion job end-to-end.
 */
export async function executeConversion(
  input: ConversionInput,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  const route = findRoute(input.inputFormat, input.outputFormat);
  if (!route) {
    return { success: false, error: `No route for ${input.inputFormat} -> ${input.outputFormat}`, errorRetryable: false };
  }

  // 1. Request descriptor from Edge Function
  onProgress?.('requesting');
  const execResult = await serverExecutor.execute({
    toolCode: 'pdf_studio',
    capability: 'pdf.convert',
    payload: {
      tool: mapCapabilityTool(input.inputFormat, input.outputFormat),
      input_format: input.inputFormat,
      output_format: input.outputFormat === 'pdf_ocr' ? 'pdf' : input.outputFormat,
      ocr_required: input.ocrRequired ?? false,
      ocr_only: input.outputFormat === 'pdf_ocr',
    },
  });

  if (!execResult.success || !execResult.descriptor) {
    return {
      success: false,
      error: execResult.error ?? 'Failed to get provider descriptor',
      errorRetryable: true,
    };
  }

  const { provider_code, credential_id, descriptor } = execResult;

  // 2. Route to provider-specific handler
  try {
    let result: ConversionResult;

    switch (descriptor.type) {
      case 'direct_upload':
        if (descriptor.provider === 'ilovepdf') {
          result = await executeIlovepdf(input, descriptor as IlovepdfDescriptor, onProgress, signal);
        } else {
          result = { success: false, error: `Unsupported direct_upload provider: ${descriptor.provider}`, errorRetryable: false };
        }
        break;

      case 'server_execute':
        if (descriptor.provider === 'cloudconvert') {
          result = await executeCloudConvert(input, descriptor as CloudConvertDescriptor, execResult.overrides, onProgress, signal);
        } else {
          result = { success: false, error: `Unsupported server_execute provider: ${descriptor.provider}`, errorRetryable: false };
        }
        break;

      default:
        result = { success: false, error: 'Unknown descriptor type', errorRetryable: false };
    }

    result.providerCode = provider_code;
    result.credentialId = credential_id;

    // 3. Cache output if successful
    if (result.success && result.outputBlob) {
      onProgress?.('caching');
      const filename = result.outputFilename ?? `${input.file.name.replace(/\.[^.]+$/, '')}.${input.outputFormat}`;
      await storeOutput(input.jobId, result.outputBlob, filename);
      result.outputFilename = filename;
      result.outputSize = result.outputBlob.size;
    }

    return result;
  } catch (err) {
    return {
      success: false,
      providerCode: provider_code,
      credentialId: credential_id,
      error: err instanceof Error ? err.message : 'Unknown error',
      errorRetryable: true,
    };
  }
}

// ─── iLovePDF execution ─────────────────────────────────────

async function executeIlovepdf(
  input: ConversionInput,
  descriptor: IlovepdfDescriptor,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  const { token, server, task } = descriptor;

  // Upload
  onProgress?.('uploading');
  const uploadForm = new FormData();
  uploadForm.append('task', task);
  uploadForm.append('file', input.file, input.file.name);

  const uploadRes = await fetch(`https://${server}/v1/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: uploadForm,
    signal,
  });

  if (!uploadRes.ok) {
    const msg = await readErrorMsg(uploadRes);
    return { success: false, error: `Upload failed: ${msg}`, errorRetryable: uploadRes.status >= 500 };
  }

  const uploadData = await uploadRes.json();
  const serverFilename = uploadData.server_filename;

  // Process
  onProgress?.('processing');
  const processRes = await fetch(`https://${server}/v1/process`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task,
      tool: mapCapabilityTool(input.inputFormat, input.outputFormat),
      files: [{ server_filename: serverFilename, filename: input.file.name }],
    }),
    signal,
  });

  if (!processRes.ok) {
    const msg = await readErrorMsg(processRes);
    return { success: false, error: `Process failed: ${msg}`, errorRetryable: processRes.status >= 500 };
  }

  // Download
  onProgress?.('downloading');
  const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (!downloadRes.ok) {
    return { success: false, error: 'Download failed', errorRetryable: true };
  }

  const blob = await downloadRes.blob();
  const filename = `${input.file.name.replace(/\.[^.]+$/, '')}.${input.outputFormat}`;

  return {
    success: true,
    outputBlob: blob,
    outputFilename: filename,
    outputSize: blob.size,
    providerJobId: task,
  };
}

// ─── CloudConvert execution ─────────────────────────────────

async function executeCloudConvert(
  input: ConversionInput,
  descriptor: CloudConvertDescriptor,
  _overrides?: Record<string, unknown>,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<ConversionResult> {
  // CloudConvert requires server-side job creation (API key never in browser)
  // For Phase 4, we use a simplified flow:
  // 1. Create job via Edge Function (second call with job creation payload)
  // 2. Upload to the import/upload task URL
  // 3. Poll until export ready
  // 4. Download

  // Note: Full CloudConvert integration requires a second Edge Function action
  // "create-job" that creates the job server-side and returns upload URL + job ID.
  // For now, return a placeholder indicating CloudConvert needs server-side job creation.

  onProgress?.('requesting');

  // Call Edge Function to create CloudConvert job
  const createResult = await serverExecutor.execute({
    toolCode: 'pdf_studio',
    capability: 'pdf.create_job',
    payload: {
      input_format: input.inputFormat,
      output_format: input.outputFormat,
      filename: input.file.name,
      filesize: input.file.size,
      credential_id: descriptor.credential_id,
    },
  });

  if (!createResult.success) {
    return {
      success: false,
      error: createResult.error ?? 'Failed to create CloudConvert job',
      errorRetryable: true,
    };
  }

  // If descriptor contains upload URL from server-created job
  const jobDescriptor = createResult.descriptor as Record<string, unknown> | undefined;
  if (!jobDescriptor?.upload_url) {
    return {
      success: false,
      error: 'CloudConvert job creation did not return upload URL. Full integration pending.',
      errorRetryable: false,
    };
  }

  // Upload
  onProgress?.('uploading');
  const uploadRes = await fetch(jobDescriptor.upload_url as string, {
    method: 'PUT',
    headers: { 'Content-Type': input.file.type || 'application/octet-stream' },
    body: input.file,
    signal,
  });

  if (!uploadRes.ok) {
    return { success: false, error: 'CloudConvert upload failed', errorRetryable: true };
  }

  // Poll for completion
  onProgress?.('processing');
  const jobId = jobDescriptor.job_id as string;

  let exportUrl: string | null = null;
  for (let i = 0; i < 60; i++) {
    if (signal?.aborted) {
      return { success: false, error: 'Cancelled', errorRetryable: false };
    }

    await sleep(Math.min(2000 + i * 500, 10000)); // backoff

    const statusResult = await serverExecutor.execute({
      toolCode: 'pdf_studio',
      capability: 'pdf.poll_job',
      payload: { job_id: jobId, credential_id: descriptor.credential_id },
    });

    if (!statusResult.success) continue;

    const statusDesc = statusResult.descriptor as Record<string, unknown> | undefined;
    const jobStatus = statusDesc?.status as string;

    if (jobStatus === 'finished' && statusDesc?.export_url) {
      exportUrl = statusDesc.export_url as string;
      break;
    }
    if (jobStatus === 'error') {
      return { success: false, error: statusDesc?.error as string ?? 'CloudConvert job failed', errorRetryable: false };
    }
  }

  if (!exportUrl) {
    return { success: false, error: 'CloudConvert job timed out', errorRetryable: true };
  }

  // Download
  onProgress?.('downloading');
  const downloadRes = await fetch(exportUrl, { signal });
  if (!downloadRes.ok) {
    return { success: false, error: 'CloudConvert download failed', errorRetryable: true };
  }

  const blob = await downloadRes.blob();
  const filename = `${input.file.name.replace(/\.[^.]+$/, '')}.${input.outputFormat}`;

  return {
    success: true,
    outputBlob: blob,
    outputFilename: filename,
    outputSize: blob.size,
    providerJobId: jobId,
  };
}

// ─── Helpers ────────────────────────────────────────────────

function mapCapabilityTool(inputFormat: string, outputFormat: string): string {
  // iLovePDF tool names
  if (inputFormat === 'pdf' && outputFormat === 'jpg') return 'pdfjpg';
  if (inputFormat === 'pdf' && outputFormat === 'png') return 'pdfjpg'; // same tool, format param
  if ((inputFormat === 'jpg' || inputFormat === 'png') && outputFormat === 'pdf') return 'imagepdf';
  if (inputFormat === 'pdf' && outputFormat === 'docx') return 'pdfoffice';
  if (['docx', 'xlsx', 'pptx'].includes(inputFormat) && outputFormat === 'pdf') return 'officepdf';
  return 'convert'; // generic
}

async function readErrorMsg(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data === 'object' && data) {
      if ('message' in data) return String(data.message);
      if ('error' in data) return String(data.error);
    }
  } catch { /* ignore */ }
  return `HTTP ${res.status}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
