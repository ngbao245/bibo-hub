// ============================================================
// PDF Studio Edit PDF — OCR service
// ============================================================
// Calls serverExecutor to run OCR on a PDF scan via iLovePDF (primary)
// or CloudConvert (fallback). Returns a searchable PDF blob.
//
// Contract:
// - Input: working revision PDF blob (or original if no revisions)
// - Output: PDF with text layer that pdf.js can read via getTextContent()
// - Provider must preserve page dimensions
// - If provider changes geometry → reject result
// ============================================================

import { serverExecutor } from '@/lib/service-registry/server-executor';

export type OcrJobStatus = 'idle' | 'requesting' | 'uploading' | 'processing' | 'downloading' | 'done' | 'error' | 'cancelled';

export interface OcrJobState {
  status: OcrJobStatus;
  jobId: string | null;
  provider: string | null;
  error: string | null;
  startedAt: string | null;
  elapsedMs: number;
}

export interface OcrResult {
  success: boolean;
  outputBlob: Blob | null;
  error: string | null;
  provider: string | null;
}

interface IlovepdfDescriptor {
  type: 'direct_upload';
  provider: string;
  token: string;
  server: string;
  task: string;
}

// ─── Main OCR function ───────────────────────────────────────

export async function runOcr(
  file: Blob,
  filename: string,
  onProgress?: (status: OcrJobStatus) => void,
  signal?: AbortSignal,
): Promise<OcrResult> {
  try {
    // 1. Request descriptor from Edge Function
    onProgress?.('requesting');
    const execResult = await serverExecutor.execute({
      toolCode: 'pdf_studio',
      capability: 'pdf.ocr',
      payload: { tool: 'ocr' },
    });

    if (!execResult.success || !execResult.descriptor) {
      return {
        success: false,
        outputBlob: null,
        error: execResult.error ?? 'Khong lay duoc credential OCR. Kiem tra cau hinh provider.',
        provider: null,
      };
    }

    const descriptor = execResult.descriptor as IlovepdfDescriptor;

    if (signal?.aborted) return cancelled();

    // 2. Upload
    onProgress?.('uploading');
    const form = new FormData();
    form.append('task', descriptor.task);
    form.append('file', file, filename);

    const uploadRes = await fetch(`https://${descriptor.server}/v1/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${descriptor.token}` },
      body: form,
      signal,
    });

    if (!uploadRes.ok) {
      const msg = await readError(uploadRes);
      return { success: false, outputBlob: null, error: `Upload that bai: ${msg}`, provider: 'ilovepdf' };
    }

    const uploadData = await uploadRes.json();
    const serverFilename = uploadData.server_filename;

    if (signal?.aborted) return cancelled();

    // 3. Process OCR
    onProgress?.('processing');
    const processRes = await fetch(`https://${descriptor.server}/v1/process`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${descriptor.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: descriptor.task,
        tool: 'ocr',
        files: [{ server_filename: serverFilename, filename }],
      }),
      signal,
    });

    if (!processRes.ok) {
      const msg = await readError(processRes);
      return { success: false, outputBlob: null, error: `OCR that bai: ${msg}`, provider: 'ilovepdf' };
    }

    if (signal?.aborted) return cancelled();

    // 4. Download result
    onProgress?.('downloading');
    const downloadRes = await fetch(
      `https://${descriptor.server}/v1/download/${descriptor.task}`,
      { headers: { Authorization: `Bearer ${descriptor.token}` }, signal },
    );

    if (!downloadRes.ok) {
      return { success: false, outputBlob: null, error: 'Tai ket qua OCR that bai.', provider: 'ilovepdf' };
    }

    const blob = await downloadRes.blob();

    onProgress?.('done');
    return { success: true, outputBlob: blob, error: null, provider: 'ilovepdf' };
  } catch (err) {
    if ((err as Error).name === 'AbortError') return cancelled();
    return {
      success: false,
      outputBlob: null,
      error: err instanceof Error ? err.message : 'Loi khong xac dinh khi chay OCR.',
      provider: null,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function cancelled(): OcrResult {
  return { success: false, outputBlob: null, error: null, provider: null };
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data === 'object' && data) {
      if ('message' in data) return String(data.message);
      if ('error' in data && typeof data.error === 'object') return JSON.stringify(data.error);
      if ('error' in data) return String(data.error);
    }
  } catch { /* ignore */ }
  return `HTTP ${res.status}`;
}
