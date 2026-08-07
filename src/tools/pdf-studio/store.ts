// ============================================================
// PDF Studio — Zustand batch/queue store (UI state only)
// ============================================================
// Source of truth: Supabase (metadata) + IndexedDB (blobs)
// This store: active UI state, local queue, progress updates
// ============================================================

import { create } from 'zustand';
import type { OutputFormat, JobStatus, ScanType } from '@/lib/pdf-studio/types';

// ─── Tool Operation type ─────────────────────────────────────

export type ToolOperation = 'merge' | 'split' | 'compress' | 'remove_pages' | 'unlock' | 'lock' | 'crop' | 'watermark' | 'edit' | 'rotate' | 'to_images' | 'convert' | 'page_numbers';

// ─── Local job entry (UI state) ──────────────────────────────

export type LocalJobStatus =
  | 'idle'         // added, not yet validated
  | 'validating'   // scanning PDF, checking limits
  | 'invalid'      // failed validation
  | JobStatus;     // server-synced statuses

export interface JobStage {
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  error?: string;
}

export interface LocalJob {
  /** Client-generated ID before server sync */
  localId: string;
  /** Server-assigned job ID after creation */
  jobId?: string;
  file: File;
  filename: string;
  inputFormat: string;
  outputFormat: OutputFormat;
  fileSize: number;
  scanType?: ScanType;
  status: LocalJobStatus;
  progress?: number;
  errorMessage?: string;
  /** Output blob cached in IndexedDB, ready for download */
  outputReady: boolean;
  outputFilename?: string;
  outputSize?: number;
  /** Timestamp for retry backoff */
  lastAttemptAt?: number;
  retryCount: number;
  /** OCR required for this job (scan/mixed PDF → editable) */
  ocrRequired: boolean;
  /** Multi-stage progress (shown when OCR needed) */
  stages?: JobStage[];
}

// ─── Store ───────────────────────────────────────────────────

interface PdfStudioState {
  // Active batch
  batchId: string | null;
  jobs: LocalJob[];
  defaultOutputFormat: OutputFormat | null;
  // Queue state
  isRunning: boolean;
  concurrency: number;
  // View
  view: 'convert' | 'history' | 'toolbox';
  activeToolOp: ToolOperation | null;

  // Pending file to open in Edit PDF (set by workspace after processing done)
  pendingEditBlob: Blob | null;
  pendingEditFilename: string | null;

  // Actions
  setView: (view: 'convert' | 'history' | 'toolbox') => void;
  setActiveToolOp: (op: ToolOperation | null) => void;
  openInEditor: (blob: Blob, filename: string) => void;
  consumePendingEdit: () => void;
  addJobs: (jobs: LocalJob[]) => void;
  updateJob: (localId: string, patch: Partial<LocalJob>) => void;
  removeJob: (localId: string) => void;
  setDefaultOutputFormat: (format: OutputFormat | null) => void;
  setBatchId: (id: string | null) => void;
  setRunning: (running: boolean) => void;
  clearBatch: () => void;
  retryFailed: () => void;
}

export const usePdfStudioStore = create<PdfStudioState>((set) => ({
  batchId: null,
  jobs: [],
  defaultOutputFormat: null,
  isRunning: false,
  concurrency: 3,
  view: 'convert',
  activeToolOp: null,
  pendingEditBlob: null,
  pendingEditFilename: null,

  setView: (view) => set({ view, activeToolOp: null }),
  setActiveToolOp: (op) => set({ activeToolOp: op }),

  // Workspace gọi sau khi xử lý xong → set pending blob + navigate to Edit PDF.
  // EditPdfWorkspace on mount consume pending (auto-load file).
  openInEditor: (blob, filename) =>
    set({
      pendingEditBlob: blob,
      pendingEditFilename: filename,
      activeToolOp: 'edit',
    }),
  consumePendingEdit: () => set({ pendingEditBlob: null, pendingEditFilename: null }),

  addJobs: (newJobs) =>
    set((s) => ({ jobs: [...s.jobs, ...newJobs] })),

  updateJob: (localId, patch) =>
    set((s) => ({
      jobs: s.jobs.map((j) => j.localId === localId ? { ...j, ...patch } : j),
    })),

  removeJob: (localId) =>
    set((s) => ({ jobs: s.jobs.filter((j) => j.localId !== localId) })),

  setDefaultOutputFormat: (format) => set({ defaultOutputFormat: format }),

  setBatchId: (id) => set({ batchId: id }),

  setRunning: (running) => set({ isRunning: running }),

  clearBatch: () =>
    set({ jobs: [], batchId: null, isRunning: false, defaultOutputFormat: null }),

  retryFailed: () =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.status === 'failed'
          ? { ...j, status: 'pending', errorMessage: undefined, retryCount: j.retryCount + 1 }
          : j,
      ),
    })),
}));

// ─── Selectors ───────────────────────────────────────────────

export function selectReadyCount(jobs: LocalJob[]): number {
  return jobs.filter((j) => j.status === 'ready').length;
}

export function selectFailedCount(jobs: LocalJob[]): number {
  return jobs.filter((j) => j.status === 'failed').length;
}

export function selectActiveCount(jobs: LocalJob[]): number {
  return jobs.filter((j) =>
    ['uploading', 'processing', 'caching_result'].includes(j.status),
  ).length;
}

export function selectPendingCount(jobs: LocalJob[]): number {
  return jobs.filter((j) => j.status === 'pending').length;
}
