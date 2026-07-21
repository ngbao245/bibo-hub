import { FORMAT_META } from './formats';
import type { SourceFormat } from './types';

// ============================================================
// Export helpers - download + filename. Stringify được IOPanel gọi
// trực tiếp qua `stringifyByFormat` để handle case `null` (CSV shape
// không phù hợp) cùng UI feedback.
// ============================================================

/** Trigger browser download cho 1 string content. */
export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke để Firefox kịp dùng URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Default filename theo format: `data.json` / `data.yaml` / ... */
export function getDefaultFilename(baseName: string, format: SourceFormat): string {
  const cleanBase = baseName.replace(/\.[^.]+$/, '') || 'data';
  return `${cleanBase}.${FORMAT_META[format].extension}`;
}