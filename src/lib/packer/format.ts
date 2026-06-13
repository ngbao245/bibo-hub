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

  // Tách theo FILE_START marker (chấp nhận whitespace trước)
  const blocks = content.split(new RegExp(`\\s*${MARKERS.FILE_START}\\s*`, 'g'));

  console.log('=== PARSE DEBUG ===');
  console.log('Content length:', content.length);
  console.log('Blocks found:', blocks.length);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block.trim()) continue;

    console.log(`\nBlock ${i}:`);
    console.log('  First 100 chars:', block.substring(0, 100));

    // Tìm PATH:
    const pathMatch = block.match(new RegExp(`${MARKERS.PATH_PREFIX}\\s*(.+?)\\s*\\n`, 'm'));
    if (!pathMatch) {
      console.log('  ERROR: No PATH found');
      continue;
    }
    const path = pathMatch[1].trim();
    console.log('  path:', path);

    // Tìm CONTENT_START:
    const contentStartIdx = block.indexOf(MARKERS.CONTENT_START);
    if (contentStartIdx === -1) {
      console.log('  ERROR: No CONTENT_START found');
      continue;
    }

    // Tìm FILE_END (có thể có whitespace trước)
    const fileEndMatch = block.match(new RegExp(`\\n\\s*${MARKERS.FILE_END}`, 'm'));
    if (!fileEndMatch) {
      console.log('  ERROR: No FILE_END found');
      continue;
    }

    const fileEndIdx = block.indexOf(fileEndMatch[0]);

    // Extract content giữa CONTENT_START và FILE_END
    const contentStart = contentStartIdx + MARKERS.CONTENT_START.length;
    let fileContent = block.substring(contentStart, fileEndIdx);

    // Trim leading newline sau CONTENT_START:
    fileContent = fileContent.replace(/^\n/, '');

    console.log('  fileContent length:', fileContent.length);

    if (path) {
      files.push({
        path,
        content: fileContent,
        size: new Blob([fileContent]).size,
      });
    }
  }

  console.log('Total files parsed:', files.length);
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
