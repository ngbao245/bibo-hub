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
  CHUNK_PREFIX: 'CHUNK: ',
  CONTENT_START: 'CONTENT_START:',
} as const;

/** Serialize 1 file thành text block đúng format.
 * File thường: PATH + CONTENT.
 * File bị chunk: thêm 1 dòng `CHUNK: i/N` giữa PATH và CONTENT_START.
 * Parser cũ không biết CHUNK vẫn parse được PATH + content (chỉ là sẽ có
 * nhiều block trùng path → file cuối thắng); parser mới gom + concat.
 */
export function serializeFile(file: PackedFile): string {
  const parts: string[] = [
    '\n',
    MARKERS.FILE_START,
    '\n',
    MARKERS.PATH_PREFIX,
    file.path,
    '\n',
  ];
  if (file.chunkIndex !== undefined && file.chunkTotal !== undefined) {
    parts.push(MARKERS.CHUNK_PREFIX, `${file.chunkIndex}/${file.chunkTotal}`, '\n');
  }
  parts.push(
    MARKERS.CONTENT_START,
    '\n',
    file.content,
    '\n',
    MARKERS.FILE_END,
    '\n',
  );
  return parts.join('');
}

/** Wrap content (1 hoặc nhiều file blocks) bằng markers PACK_START/END */
export function wrapPart(body: string): string {
  return MARKERS.PACK_START + '\n' + body + '\n' + MARKERS.PACK_END;
}

/**
 * Parse text → mảng PackedFile.
 * Dùng indexOf để nhanh + chịu lỗi tốt (v1 đã verify).
 * Bỏ qua marker PACK_START/PACK_END (chỉ cần FILE_START/END markers).
 *
 * Nếu nhiều block có cùng PATH và có line `CHUNK: i/N` → gom theo index
 * rồi concat content thành 1 file duy nhất.
 */
export function parsePackedContent(content: string): PackedFile[] {
  type Chunk = { index: number; total: number; content: string };
  const single: PackedFile[] = [];
  const chunked = new Map<string, Chunk[]>();

  // Tách theo FILE_START marker (chấp nhận whitespace trước)
  const blocks = content.split(new RegExp(`\\s*${MARKERS.FILE_START}\\s*`, 'g'));

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block.trim()) continue;

    // Tìm PATH:
    const pathMatch = block.match(new RegExp(`${MARKERS.PATH_PREFIX}\\s*(.+?)\\s*\\n`, 'm'));
    if (!pathMatch) continue;
    const path = pathMatch[1].trim();
    if (!path) continue;

    // Tìm CHUNK: i/N (optional — file thường không có)
    const chunkMatch = block.match(
      new RegExp(`${MARKERS.CHUNK_PREFIX}\\s*(\\d+)\\s*/\\s*(\\d+)\\s*\\n`, 'm'),
    );

    // Tìm CONTENT_START:
    const contentStartIdx = block.indexOf(MARKERS.CONTENT_START);
    if (contentStartIdx === -1) continue;

    // Tìm FILE_END (có thể có whitespace trước)
    const fileEndMatch = block.match(new RegExp(`\\n\\s*${MARKERS.FILE_END}`, 'm'));
    if (!fileEndMatch) continue;

    const fileEndIdx = block.indexOf(fileEndMatch[0]);

    // Extract content giữa CONTENT_START và FILE_END
    const contentStart = contentStartIdx + MARKERS.CONTENT_START.length;
    let fileContent = block.substring(contentStart, fileEndIdx);
    // Trim leading newline sau CONTENT_START:
    fileContent = fileContent.replace(/^\n/, '');

    if (chunkMatch) {
      const idx = parseInt(chunkMatch[1], 10);
      const total = parseInt(chunkMatch[2], 10);
      const list = chunked.get(path) ?? [];
      list.push({ index: idx, total, content: fileContent });
      chunked.set(path, list);
    } else {
      single.push({
        path,
        content: fileContent,
        size: new Blob([fileContent]).size,
      });
    }
  }

  // Gộp các chunk trùng path
  const merged: PackedFile[] = [];
  for (const [path, list] of chunked) {
    list.sort((a, b) => a.index - b.index);
    const total = list[0]?.total ?? list.length;
    // Detect chunk thiếu (vd 1/3 + 3/3, miss 2/3) — vẫn merge những phần có
    // nhưng path đánh dấu là incomplete để caller (unpack) log.
    const seenIdx = new Set(list.map((c) => c.index));
    const missing: number[] = [];
    for (let i = 1; i <= total; i++) {
      if (!seenIdx.has(i)) missing.push(i);
    }
    const joined = list.map((c) => c.content).join('');
    merged.push({
      path,
      content: joined,
      size: new Blob([joined]).size,
      chunkIndex: missing.length === 0 ? undefined : list.length,
      chunkTotal: missing.length === 0 ? undefined : total,
    });
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[packer] File "${path}" thiếu chunk ${missing.join(', ')}/${total}`);
    }
  }

  return [...single, ...merged];
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