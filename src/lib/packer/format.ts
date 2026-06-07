import type { PackedFile } from './types';

// ============================================================
// Pack format - markers v1 tương thích
// ============================================================
//
// Format giữ y v1 để file .txt cũ vẫn unpack được:
//
//   //
//   ===FILE_START===
//   PATH: src/App.tsx
//   CONTENT_START:
//   ...nội dung file...
//   ===FILE_END===
//
//   ===FILE_START===
//   PATH: package.json
//   CONTENT_START:
//   ...
//   ===FILE_END===
//
//   
// ============================================================

export const MARKERS = {
  PACK_START: '',
  PACK_END: '',
  FILE_START: '===FILE_START===',
  FILE_END: '===FILE_END===',
  PATH_PREFIX: 'PATH: ',
  CONTENT_START: 'CONTENT_START:',
} as const;

/** Serialize 1 file thành text block đúng format */
export function serializeFile(file: PackedFile): string {
  return [
    '\n',
    MARKERS.FILE_START,
    '\n',
    MARKERS.PATH_PREFIX,
    file.path,
    '\n',
    MARKERS.CONTENT_START,
    '\n',
    file.content,
    '\n',
    MARKERS.FILE_END,
    '\n',
  ].join('');
}

/** Wrap content (1 hoặc nhiều file blocks) bằng markers PACK_START/END */
export function wrapPart(body: string): string {
  return MARKERS.PACK_START + '\n' + body + '\n' + MARKERS.PACK_END;
}

/**
 * Parse text → mảng PackedFile.
 * Dùng indexOf để nhanh + chịu lỗi tốt (v1 đã verify).
 * Bỏ qua marker PACK_START/PACK_END (chỉ cần FILE_START/END markers).
 */
export function parsePackedContent(content: string): PackedFile[] {
  const files: PackedFile[] = [];
  let pos = 0;

  while (true) {
    const fileStart = content.indexOf(MARKERS.FILE_START, pos);
    if (fileStart === -1) break;

    const pathStart = content.indexOf(MARKERS.PATH_PREFIX, fileStart);
    if (pathStart === -1) break;

    const pathEnd = content.indexOf('\n', pathStart + MARKERS.PATH_PREFIX.length);
    if (pathEnd === -1) break;

    const path = content
      .substring(pathStart + MARKERS.PATH_PREFIX.length, pathEnd)
      .trim();

    const contentMarker = MARKERS.CONTENT_START + '\n';
    const contentStart = content.indexOf(contentMarker, pathEnd);
    if (contentStart === -1) break;

    const fileEnd = content.indexOf(
      '\n' + MARKERS.FILE_END,
      contentStart + contentMarker.length,
    );
    if (fileEnd === -1) break;

    const fileContent = content.substring(
      contentStart + contentMarker.length,
      fileEnd,
    );

    files.push({
      path,
      content: fileContent,
      size: new Blob([fileContent]).size,
    });

    pos = fileEnd + ('\n' + MARKERS.FILE_END).length;
  }

  return files;
}

/**
 * Detect số part từ text user paste.
 * Đếm số lần xuất hiện PACK_START — mỗi lần là 1 part.
 */
export function countParts(content: string): number {
  return (content.match(new RegExp(MARKERS.PACK_START, 'g')) ?? []).length;
}

/**
 * Strip markers PACK_START/PACK_END đầu/cuối khi merge multiple parts.
 * Markers FILE_START/FILE_END giữ nguyên.
 */
export function stripPartMarkers(content: string): string {
  return content
    .replace(new RegExp(MARKERS.PACK_START + '\\n?', 'g'), '')
    .replace(new RegExp('\\n?' + MARKERS.PACK_END, 'g'), '');
}
