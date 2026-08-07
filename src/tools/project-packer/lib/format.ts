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
 * Dùng sequential indexOf scan để tránh split nhầm khi content file
 * chứa literal markers (VD project-packer pack chính nó).
 *
 * Algorithm:
 * 1. Tìm FILE_START marker
 * 2. Ngay sau đó tìm PATH: (dòng kế)
 * 3. Optional: tìm CHUNK: i/N
 * 4. Tìm CONTENT_START:
 * 5. Tìm FILE_END — content = text giữa CONTENT_START:\n và \n trước FILE_END
 * 6. Nhảy cursor tới sau FILE_END, lặp lại
 *
 * Cách này KHÔNG scan markers bên trong content area → an toàn khi file
 * chứa ===FILE_START=== / PATH: / CONTENT_START: trong source code.
 *
 * Nếu nhiều block có cùng PATH và có CHUNK: i/N → gom + concat.
 */
export function parsePackedContent(content: string): PackedFile[] {
    type Chunk = { index: number; total: number; content: string };
    const single: PackedFile[] = [];
    const chunked = new Map<string, Chunk[]>();

    let cursor = 0;

    while (cursor < content.length) {
        // Step 1: Tìm FILE_START
        const startIdx = content.indexOf(MARKERS.FILE_START, cursor);
        if (startIdx === -1) break;

        // Di chuyển cursor qua FILE_START marker
        const afterStart = startIdx + MARKERS.FILE_START.length;

        // Step 2: Tìm PATH: — scan tối đa 200 chars sau FILE_START (đủ cho whitespace/newlines)
        const searchRegion = content.substring(afterStart, afterStart + 500);

        // Tìm PATH: dòng đầu tiên (skip whitespace/newlines trước)
        const pathMatch = searchRegion.match(/^\s*PATH:\s*(.+?)[ \t]*(?:\r?\n|$)/m);
        if (!pathMatch) {
            // Không tìm thấy PATH: → skip marker này, có thể là marker giả trong content
            cursor = afterStart;
            continue;
        }
        const path = pathMatch[1].trim();
        if (!path) {
            cursor = afterStart;
            continue;
        }

        // Vị trí tuyệt đối sau PATH line
        const afterPathLine = afterStart + (pathMatch.index ?? 0) + pathMatch[0].length;

        // Step 3: Tìm CHUNK: (optional) — ngay sau PATH line
        const chunkRegion = content.substring(afterPathLine, afterPathLine + 100);
        const chunkMatch = chunkRegion.match(/^\s*CHUNK:\s*(\d+)\s*\/\s*(\d+)\s*(?:\r?\n|$)/m);

        let afterChunkLine = afterPathLine;
        if (chunkMatch) {
            afterChunkLine = afterPathLine + (chunkMatch.index ?? 0) + chunkMatch[0].length;
        }

        // Step 4: Tìm CONTENT_START: — tìm trong 200 chars sau path/chunk
        const contentStartRegion = content.substring(afterChunkLine, afterChunkLine + 200);
        const csIdx = contentStartRegion.indexOf(MARKERS.CONTENT_START);
        if (csIdx === -1) {
            // Không có CONTENT_START → block không hợp lệ, skip
            cursor = afterStart;
            continue;
        }
        // Content bắt đầu sau "CONTENT_START:" + optional \n
        let contentBegin = afterChunkLine + csIdx + MARKERS.CONTENT_START.length;
        if (content[contentBegin] === '\n') contentBegin++;
        else if (content[contentBegin] === '\r' && content[contentBegin + 1] === '\n') contentBegin += 2;

        // Step 5: Tìm FILE_END — SAU contentBegin
        // Tìm ===FILE_END=== ở đầu dòng (hoặc sau newline + optional whitespace)
        const fileEndIdx = findFileEnd(content, contentBegin);
        if (fileEndIdx === -1) {
            // Không tìm thấy FILE_END → coi như block bị cắt, lấy tới hết text
            cursor = content.length;
            // Vẫn cố extract content (incomplete file)
            const fileContent = content.substring(contentBegin);
            single.push({
                path,
                content: fileContent,
                size: new Blob([fileContent]).size,
            });
            break;
        }

        // Content = text giữa contentBegin và trước FILE_END
        // Trim trailing \n ngay trước FILE_END marker (1 \n là separator, không phải content)
        let contentEnd = fileEndIdx;
        if (content[contentEnd - 1] === '\n') contentEnd--;
        if (content[contentEnd - 1] === '\r') contentEnd--;

        const fileContent = content.substring(contentBegin, contentEnd);

        // Step 6: Di chuyển cursor qua FILE_END
        cursor = fileEndIdx + MARKERS.FILE_END.length;

        // Accumulate
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
 * Tìm FILE_END marker sau vị trí `from`.
 * FILE_END phải đứng ở đầu dòng (sau \n hoặc optional whitespace).
 * Trả về index bắt đầu của marker, hoặc -1 nếu không tìm thấy.
 */
function findFileEnd(content: string, from: number): number {
    let pos = from;
    while (pos < content.length) {
        const idx = content.indexOf(MARKERS.FILE_END, pos);
        if (idx === -1) return -1;

        // Validate: marker phải ở đầu dòng (idx === 0, hoặc ký tự trước là \n,
        // hoặc giữa \n và marker chỉ có whitespace)
        if (idx === 0) return idx;

        // Tìm ngược từ idx-1 tới \n gần nhất
        let lineStart = idx - 1;
        while (lineStart >= from && content[lineStart] !== '\n') {
            lineStart--;
        }
        // lineStart bây giờ là vị trí \n (hoặc < from nếu không có \n)
        // Kiểm tra giữa \n+1 và idx chỉ có whitespace
        const between = content.substring(lineStart + 1, idx);
        if (between.trim() === '') {
            return idx;
        }

        // Không hợp lệ (FILE_END nằm giữa dòng, có thể là content) → skip
        pos = idx + MARKERS.FILE_END.length;
    }
    return -1;
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