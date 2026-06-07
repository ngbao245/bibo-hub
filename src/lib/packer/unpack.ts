import type { PackedFile } from './types';
import { parsePackedContent, MARKERS } from './format';

// ============================================================
// Unpack flow: text từ user → PackedFile[] → ZIP blob
// ============================================================
//
// Input có thể là:
// - 1 part đơn lẻ
// - Nhiều part nối liền nhau (PACK_END...PACK_START giữa)
// - Mix giữa text thừa (greeting chat...) - parser tự bỏ qua
//
// Algorithm:
// 1. Strip toàn bộ marker PACK_START/PACK_END (chỉ giữ FILE_START/END)
// 2. parsePackedContent() trả về mảng PackedFile
// 3. Validate (path không rỗng, không trùng) → output
// ============================================================

export function unpackText(text: string): {
  files: PackedFile[];
  partsDetected: number;
} {
  // Đếm số FILE_START thay vì PACK_START (vì PACK markers đã bỏ)
  const partsDetected = (text.match(new RegExp(MARKERS.FILE_START, 'g')) ?? [])
    .length;

  // Strip PACK_START/PACK_END nếu có (backward compat với v1 cũ có markers)
  // Nếu PACK markers rỗng thì không ảnh hưởng
  const cleaned = text
    .replace(new RegExp(MARKERS.PACK_START, 'g'), '')
    .replace(new RegExp(MARKERS.PACK_END, 'g'), '');

  const files = parsePackedContent(cleaned);
  return { files, partsDetected };
}

// ============================================================
// Build ZIP blob từ mảng PackedFile (dùng JSZip lazy load)
// ============================================================

export async function buildZip(files: PackedFile[]): Promise<Blob> {
  // Lazy import JSZip để không tăng initial bundle
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/** Trigger browser download cho 1 blob */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
