// ============================================================
// PDF Studio — Type definitions (data contract)
// ============================================================

// ─── Enums ──────────────────────────────────────────────────

export type BatchStatus = 'active' | 'completed' | 'partial' | 'failed' | 'cancelled';

export type JobStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'caching_result'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'needs_file';

export type ScanClassification = 'text' | 'scan' | 'mixed';

/** Alias for backward compat */
export type ScanType = ScanClassification;

export type ReservationStatus = 'reserved' | 'committed' | 'refunded' | 'expired';

/** Supported input/output formats in Phase 1 */
export type ConvertFormat =
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'xlsx'
  | 'xls'
  | 'pptx'
  | 'ppt'
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'epub';

/** Normalized output formats (what we produce) */
export type OutputFormat = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'png' | 'jpg' | 'epub' | 'pdf_ocr';

/** Provider codes for conversion */
export type ConversionProvider = 'cloudconvert' | 'ilovepdf';

// ─── Batch ──────────────────────────────────────────────────

export interface PdfStudioBatchSettings {
  concurrency?: number;
  max_files?: number;
  max_file_size_mb?: number;
  max_batch_size_mb?: number;
}

export interface PdfStudioBatch {
  id: string;
  user_id: string;
  status: BatchStatus;
  default_output_format: OutputFormat | null;
  total_files: number;
  completed_files: number;
  failed_files: number;
  settings_json: PdfStudioBatchSettings;
  created_at: string;
  updated_at: string;
}

// ─── Job ────────────────────────────────────────────────────

export interface PdfStudioJob {
  id: string;
  batch_id: string;
  user_id: string;
  status: JobStatus;
  input_filename: string;
  input_format: string;
  input_size_bytes: number | null;
  output_format: OutputFormat;
  output_filename: string | null;
  output_size_bytes: number | null;
  scan_classification: ScanClassification | null;
  provider_code: ConversionProvider | null;
  provider_job_id: string | null;
  provider_task_id: string | null;
  credential_id: string | null;
  reservation_id: string | null;
  error_code: string | null;
  error_message: string | null;
  error_retryable: boolean | null;
  retry_count: number;
  idempotency_key: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Capability Catalog ─────────────────────────────────────

export interface CapabilityCatalogEntry {
  id: string;
  provider_code: ConversionProvider;
  input_format: string;
  output_format: string;
  engine: string | null;
  verified: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Reservation ────────────────────────────────────────────

export interface PdfStudioReservation {
  id: string;
  job_id: string;
  user_id: string;
  credential_id: string;
  provider_code: ConversionProvider;
  estimated_credits: number;
  actual_credits: number | null;
  status: ReservationStatus;
  reserved_at: string;
  resolved_at: string | null;
  created_at: string;
}

// ─── Tool Settings ──────────────────────────────────────────

export interface PdfStudioToolSettings {
  max_files_per_batch: number;
  max_file_size_mb: number;
  max_batch_size_mb: number;
  concurrency: number;
  grace_period_minutes: number;
  safety_retention_hours: number;
}

// ─── Conversion Route Map ───────────────────────────────────

export interface ConversionRoute {
  input_format: string;
  output_format: OutputFormat;
  primary_provider: ConversionProvider;
  fallback_provider?: ConversionProvider;
}

/** Default routing per spec design.md */
export const DEFAULT_ROUTING: ConversionRoute[] = [
  // PDF → Office/Ebook (CloudConvert primary)
  { input_format: 'pdf', output_format: 'docx', primary_provider: 'cloudconvert' },
  { input_format: 'pdf', output_format: 'xlsx', primary_provider: 'cloudconvert' },
  { input_format: 'pdf', output_format: 'pptx', primary_provider: 'cloudconvert' },
  { input_format: 'pdf', output_format: 'epub', primary_provider: 'cloudconvert' },
  // PDF → Image
  { input_format: 'pdf', output_format: 'png', primary_provider: 'cloudconvert' },
  { input_format: 'pdf', output_format: 'jpg', primary_provider: 'ilovepdf', fallback_provider: 'cloudconvert' },
  // Office/Ebook → PDF (CloudConvert primary)
  { input_format: 'docx', output_format: 'pdf', primary_provider: 'cloudconvert', fallback_provider: 'ilovepdf' },
  { input_format: 'xlsx', output_format: 'pdf', primary_provider: 'cloudconvert', fallback_provider: 'ilovepdf' },
  { input_format: 'pptx', output_format: 'pdf', primary_provider: 'cloudconvert', fallback_provider: 'ilovepdf' },
  { input_format: 'epub', output_format: 'pdf', primary_provider: 'cloudconvert' },
  // Image → PDF (iLovePDF primary)
  { input_format: 'png', output_format: 'pdf', primary_provider: 'ilovepdf', fallback_provider: 'cloudconvert' },
  { input_format: 'jpg', output_format: 'pdf', primary_provider: 'ilovepdf', fallback_provider: 'cloudconvert' },
];

// ─── Input types for mutations ──────────────────────────────

export interface CreateBatchInput {
  default_output_format?: OutputFormat;
  settings_json?: PdfStudioBatchSettings;
}

export interface CreateJobInput {
  batch_id: string;
  input_filename: string;
  input_format: string;
  input_size_bytes?: number;
  output_format: OutputFormat;
  scan_classification?: ScanClassification;
}

export interface UpdateJobStatusInput {
  id: string;
  status: JobStatus;
  provider_code?: ConversionProvider;
  provider_job_id?: string;
  provider_task_id?: string;
  credential_id?: string;
  reservation_id?: string;
  output_filename?: string;
  output_size_bytes?: number;
  error_code?: string;
  error_message?: string;
  error_retryable?: boolean;
  started_at?: string;
  completed_at?: string;
}
