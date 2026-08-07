// ============================================================
// PDF Studio — Format validation, output mapping, limits
// ============================================================

import type { OutputFormat, ConversionRoute } from '@/lib/pdf-studio/types';
import { DEFAULT_ROUTING } from '@/lib/pdf-studio/types';

// ─── Supported input formats (extensions) ───────────────────

export const SUPPORTED_INPUT_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'epub',
]);

// ─── MIME → extension mapping ───────────────────────────────

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/epub+zip': 'epub',
};

// ─── Magic bytes for format detection ───────────────────────

const MAGIC_SIGNATURES: Array<{ ext: string; bytes: number[]; offset?: number }> = [
  { ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] }, // .PNG
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'epub', bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (zip-based)
  // Office Open XML also starts with PK
  { ext: 'docx', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { ext: 'xlsx', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { ext: 'pptx', bytes: [0x50, 0x4b, 0x03, 0x04] },
  // Legacy Office (DOC/XLS/PPT) — Compound File Binary
  { ext: 'doc', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
  { ext: 'xls', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
  { ext: 'ppt', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
];

// ─── Output compatibility matrix ───────────────────────────

export type ScanType = 'text' | 'scan' | 'mixed';

interface OutputOption {
  format: OutputFormat;
  label: string;
}

const PDF_ALL_OUTPUTS: OutputOption[] = [
  { format: 'docx', label: 'Word (.docx)' },
  { format: 'xlsx', label: 'Excel (.xlsx)' },
  { format: 'pptx', label: 'PowerPoint (.pptx)' },
  { format: 'epub', label: 'EPUB (.epub)' },
  { format: 'png', label: 'PNG (.png)' },
  { format: 'jpg', label: 'JPG (.jpg)' },
  { format: 'pdf_ocr', label: 'PDF (OCR)' },
];

const PDF_TEXT_OUTPUTS: OutputOption[] = [
  { format: 'docx', label: 'Word (.docx)' },
  { format: 'xlsx', label: 'Excel (.xlsx)' },
  { format: 'pptx', label: 'PowerPoint (.pptx)' },
  { format: 'epub', label: 'EPUB (.epub)' },
  { format: 'png', label: 'PNG (.png)' },
  { format: 'jpg', label: 'JPG (.jpg)' },
];

const NON_PDF_OUTPUTS: OutputOption[] = [
  { format: 'pdf', label: 'PDF (.pdf)' },
];

/**
 * Get valid output formats for a given input.
 * Returns outputs with labels for dropdown rendering.
 */
export function getValidOutputs(
  inputFormat: string,
  scanType?: ScanType,
): OutputOption[] {
  const normalized = normalizeExtension(inputFormat);

  if (normalized === 'pdf') {
    // Scan/mixed: show all outputs including PDF (OCR)
    if (scanType === 'scan' || scanType === 'mixed') {
      return PDF_ALL_OUTPUTS;
    }
    // Text PDF: no need for OCR option
    return PDF_TEXT_OUTPUTS;
  }

  // Non-PDF → always PDF
  return NON_PDF_OUTPUTS;
}

/**
 * Check if a specific output is valid for input+scan combination.
 */
export function isOutputValid(
  inputFormat: string,
  outputFormat: OutputFormat,
  scanType?: ScanType,
): boolean {
  const valid = getValidOutputs(inputFormat, scanType);
  return valid.some((o) => o.format === outputFormat);
}

/**
 * Check if OCR is required for this input/output combination.
 */
export function isOcrRequired(
  inputFormat: string,
  outputFormat: OutputFormat,
  scanType?: ScanType,
): boolean {
  if (normalizeExtension(inputFormat) !== 'pdf') return false;
  if (outputFormat === 'pdf_ocr') return true;
  if (scanType === 'scan' || scanType === 'mixed') {
    // OCR needed for editable formats when PDF has scan pages
    const editableFormats: OutputFormat[] = ['docx', 'xlsx', 'pptx', 'epub'];
    return editableFormats.includes(outputFormat);
  }
  return false;
}

/**
 * Get default output format for a given input.
 */
export function getDefaultOutput(inputFormat: string, _scanType?: ScanType): OutputFormat {
  const normalized = normalizeExtension(inputFormat);
  if (normalized === 'pdf') {
    return 'docx';
  }
  return 'pdf';
}

// ─── Format detection ───────────────────────────────────────

/**
 * Normalize extension from filename or MIME type.
 */
export function normalizeExtension(input: string): string {
  const lower = input.toLowerCase().trim();
  // Check if it's a MIME type
  if (lower.includes('/')) {
    return MIME_TO_EXT[lower] ?? '';
  }
  // Strip leading dot
  const ext = lower.startsWith('.') ? lower.slice(1) : lower;
  // Normalize variants
  if (ext === 'jpeg') return 'jpg';
  if (ext === 'doc') return 'docx'; // treat legacy as modern for routing
  if (ext === 'xls') return 'xlsx';
  if (ext === 'ppt') return 'pptx';
  return ext;
}

/**
 * Extract extension from filename.
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Validate file format by extension.
 * Returns normalized extension or null if unsupported.
 */
export function validateFileFormat(file: File): string | null {
  // Try MIME first
  const mimeExt = MIME_TO_EXT[file.type];
  if (mimeExt && SUPPORTED_INPUT_EXTENSIONS.has(mimeExt)) {
    return mimeExt;
  }

  // Fallback to extension
  const ext = getFileExtension(file.name);
  if (SUPPORTED_INPUT_EXTENSIONS.has(ext)) {
    return ext;
  }

  return null;
}

/**
 * Detect format by magic bytes (first 8 bytes).
 * Use for extra validation when extension/MIME is ambiguous.
 */
export async function detectByMagic(file: File): Promise<string | null> {
  const slice = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(slice);

  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (bytes[offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return sig.ext;
  }

  return null;
}

// ─── Routing helper ─────────────────────────────────────────

/**
 * Find the conversion route for input→output pair.
 */
export function findRoute(inputFormat: string, outputFormat: OutputFormat): ConversionRoute | null {
  const normalized = normalizeExtension(inputFormat);
  return DEFAULT_ROUTING.find(
    (r) => r.input_format === normalized && r.output_format === outputFormat,
  ) ?? null;
}

// ─── Batch limit validation ─────────────────────────────────

export interface BatchLimits {
  maxFiles: number;
  maxFileSizeMb: number;
  maxBatchSizeMb: number;
}

export interface LimitViolation {
  type: 'file_count' | 'file_size' | 'batch_size';
  message: string;
  fileIndex?: number;
}

/**
 * Validate batch against limits.
 * Returns array of violations (empty = pass).
 */
export function validateBatchLimits(
  files: File[],
  limits: BatchLimits,
): LimitViolation[] {
  const violations: LimitViolation[] = [];

  if (files.length > limits.maxFiles) {
    violations.push({
      type: 'file_count',
      message: `Toi da ${limits.maxFiles} file, dang chon ${files.length}`,
    });
  }

  const maxFileBytes = limits.maxFileSizeMb * 1024 * 1024;
  const maxBatchBytes = limits.maxBatchSizeMb * 1024 * 1024;
  let totalSize = 0;

  for (let i = 0; i < files.length; i++) {
    if (files[i].size > maxFileBytes) {
      violations.push({
        type: 'file_size',
        message: `"${files[i].name}" vuot ${limits.maxFileSizeMb} MB`,
        fileIndex: i,
      });
    }
    totalSize += files[i].size;
  }

  if (totalSize > maxBatchBytes) {
    violations.push({
      type: 'batch_size',
      message: `Tong batch ${(totalSize / 1024 / 1024).toFixed(1)} MB vuot ${limits.maxBatchSizeMb} MB`,
    });
  }

  return violations;
}
