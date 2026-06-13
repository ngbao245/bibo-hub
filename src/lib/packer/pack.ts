
import type { PackedFile, PackPart, PackOptions } from './types';
import { serializeFile, wrapPart, MARKERS } from './format';

// ============================================================
// Pack flow: PackedFile[] → PackPart[]
// ============================================================
//
// Algorithm:
// 1. Serialize từng file thành text block
// 2. Greedy fit: nhồi block vào part hiện tại nếu chưa vượt threshold
// 3. Khi vượt → đẩy part hiện tại ra, mở part mới
// 4. Nếu 1 file đơn lẻ > threshold → vẫn cho vào part riêng (không cắt giữa file)
//
// Trả về mảng PackPart, mỗi part đã wrap PACK_START/PACK_END.
// ============================================================

const WRAPPER_OVERHEAD =
  MARKERS.PACK_START.length + MARKERS.PACK_END.length + 2; // 2 \n

export async function packFiles(files: PackedFile[], options: PackOptions): Promise<PackPart[]> {
  const parts: PackPart[] = [];
  // Buffer mỗi part dùng array để tránh string concat O(n²)
  let currentBlocks: string[] = [];
  let currentSize = 0;
  let currentFiles: string[] = [];

  function flushPart() {
    if (currentBlocks.length === 0) return;
    const body = currentBlocks.join('');
    parts.push(buildPart(parts.length + 1, body, currentFiles));
    currentBlocks = [];
    currentSize = 0;
    currentFiles = [];
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const block = serializeFile(file);
    const projectedSize = currentSize + block.length + WRAPPER_OVERHEAD;

    if (projectedSize > options.maxCharsPerPart && currentSize > 0) {
      flushPart();
    }

    currentBlocks.push(block);
    currentSize += block.length;
    currentFiles.push(file.path);

    // Yield mỗi 50 file để tránh freeze khi serialize
    if (i % 50 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  flushPart();

  return parts.map((p) => ({ ...p, total: parts.length }));
}

function buildPart(index: number, body: string, fileNames: string[]): PackPart {
  const content = wrapPart(body);
  return {
    index,
    total: 0, // sẽ điền sau khi biết total
    content,
    charCount: content.length,
    fileNames,
  };
}

// ============================================================
// Read file content - SEQUENTIAL, yield mỗi file để tránh crash
// ============================================================
//
// Ưu tiên: KHÔNG CRASH > tốc độ.
// Đọc từng file 1, yield giữa mỗi file để browser xử lý event.
// ============================================================

const MAX_FILE_SIZE = 200 * 1024; // 200KB

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.webm', '.ogg', '.wav', '.flac',
  '.zip', '.gz', '.tar', '.rar', '.7z', '.bz2',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.lock',
  '.map', // source maps thường rất lớn
]);

function isBinaryFile(path: string): boolean {
  const ext = '.' + (path.split('.').pop()?.toLowerCase() ?? '');
  return BINARY_EXTENSIONS.has(ext);
}

export interface ReadProgress {
  current: number;
  total: number;
  currentPath: string;
}

export async function readFiles(
  files: { file: File; path: string }[],
  onProgress?: (progress: ReadProgress) => void,
  signal?: AbortSignal,
): Promise<{ files: PackedFile[]; failed: { path: string; reason: string }[] }> {
  const result: PackedFile[] = [];
  const failed: { path: string; reason: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) break;

    const { file, path } = files[i];

    // Yield MỖII file — cho browser thở, không freeze
    if (i % 5 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    // Guard 1: skip binary
    if (isBinaryFile(path)) {
      failed.push({ path, reason: 'Binary file (skipped)' });
      continue;
    }

    // Guard 2: skip quá lớn
    if (file.size > MAX_FILE_SIZE) {
      failed.push({ path, reason: `Quá lớn (${(file.size / 1024).toFixed(0)}KB)` });
      continue;
    }

    try {
      const content = await readFileAsText(file);
      if (content === null) {
        failed.push({ path, reason: 'Cannot read' });
        continue;
      }
      // Guard 3: binary disguised
      if (content.includes('\0')) {
        failed.push({ path, reason: 'Binary content' });
        continue;
      }
      result.push({ path, content, size: file.size });
    } catch (e) {
      failed.push({ path, reason: String(e) });
    }

    // Progress
    if (i % 10 === 0 || i === files.length - 1) {
      onProgress?.({ current: i + 1, total: files.length, currentPath: path });
    }
  }

  return { files: result, failed };
}

function readFileAsText(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result ?? ''));
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}