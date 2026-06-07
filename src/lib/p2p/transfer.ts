// ============================================================
// P2P File Transfer - protocol qua DataChannel
// ============================================================
//
// Mỗi file được truyền qua sequence message:
//   1. { type: 'meta', id, name, size, mime }
//   2. N x { type: 'chunk', id, index, data: ArrayBuffer }
//   3. { type: 'done', id }
//
// Receiver assemble chunks lại theo index, reconstruct File.
//
// Chunk size 64KB — match max của WebRTC DataChannel (16KB-256KB tuỳ
// browser). 64KB an toàn ở mọi browser.
//
// Backpressure: kiểm tra `bufferedAmount` của DataChannel, dừng send
// khi buffer > HIGH_WATER, đợi rớt xuống LOW_WATER mới gửi tiếp. Tránh
// drop chunk hoặc treo browser khi gửi file lớn.
// ============================================================

export const CHUNK_SIZE = 64 * 1024; // 64KB
export const BUFFER_HIGH_WATER = 8 * 1024 * 1024; // 8MB — pause khi buffer > đây
export const BUFFER_LOW_WATER = 1 * 1024 * 1024;  // 1MB — resume khi buffer < đây

export type TransferMessage =
  | { type: 'meta'; id: string; name: string; size: number; mime: string; totalChunks: number }
  | { type: 'chunk'; id: string; index: number; data: ArrayBuffer }
  | { type: 'done'; id: string }
  | { type: 'cancel'; id: string };

/** Quá trình gửi 1 file: callback progress(sent, total) */
export interface SendProgress {
  fileId: string;
  fileName: string;
  sent: number;
  total: number;
}

/**
 * Chia file thành chunks, gửi qua send function.
 * `send` thường là `connection.send` của PeerJS.
 * `getBufferedAmount` trả về `dataChannel.bufferedAmount` để backpressure.
 * Nếu undefined → bỏ qua check (vẫn chạy nhưng dễ tắc với file lớn).
 */
export async function sendFile(
  file: File,
  fileId: string,
  send: (msg: TransferMessage) => void,
  onProgress?: (p: SendProgress) => void,
  signal?: AbortSignal,
  getBufferedAmount?: () => number,
): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Step 1: meta
  send({
    type: 'meta',
    id: fileId,
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
    totalChunks,
  });

  // Yield để meta đến trước chunk 0
  await new Promise((r) => setTimeout(r, 50));

  // Step 2: chunks
  let sent = 0;
  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) {
      send({ type: 'cancel', id: fileId });
      throw new Error('Aborted');
    }

    // Backpressure: nếu buffer cao, đợi xuống thấp mới gửi tiếp
    if (getBufferedAmount) {
      while (getBufferedAmount() > BUFFER_HIGH_WATER) {
        if (signal?.aborted) throw new Error('Aborted');
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const slice = file.slice(start, end);
    const buf = await slice.arrayBuffer();

    send({ type: 'chunk', id: fileId, index: i, data: buf });
    sent += buf.byteLength;

    // Progress mỗi chunk 5 hoặc cuối
    if (i % 5 === 0 || i === totalChunks - 1) {
      onProgress?.({ fileId, fileName: file.name, sent, total: file.size });
    }

    // Yield mỗi 10 chunks tránh chiếm CPU
    if (i % 10 === 9) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Step 3: done
  send({ type: 'done', id: fileId });
}

// ============================================================
// Receiver assembler
// ============================================================

export interface ReceivingFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  totalChunks: number;
  receivedChunks: ArrayBuffer[];
  receivedBytes: number;
  done: boolean;
}

export class FileReceiver {
  private files = new Map<string, ReceivingFile>();

  /** Handle 1 message từ peer. Gọi callbacks khi thấy meta/chunk/done. */
  handle(
    msg: TransferMessage,
    callbacks: {
      onStart?: (file: ReceivingFile) => void;
      onProgress?: (file: ReceivingFile) => void;
      onComplete?: (file: ReceivingFile, blob: Blob) => void;
      onCancel?: (id: string) => void;
    },
  ): void {
    if (msg.type === 'meta') {
      const file: ReceivingFile = {
        id: msg.id,
        name: msg.name,
        size: msg.size,
        mime: msg.mime,
        totalChunks: msg.totalChunks,
        receivedChunks: new Array(msg.totalChunks),
        receivedBytes: 0,
        done: false,
      };
      this.files.set(msg.id, file);
      callbacks.onStart?.(file);
      return;
    }

    if (msg.type === 'chunk') {
      const file = this.files.get(msg.id);
      if (!file || file.done) return;
      if (file.receivedChunks[msg.index]) return; // dup
      file.receivedChunks[msg.index] = msg.data;
      file.receivedBytes += msg.data.byteLength;
      callbacks.onProgress?.(file);
      return;
    }

    if (msg.type === 'done') {
      const file = this.files.get(msg.id);
      if (!file) return;
      file.done = true;
      const blob = new Blob(file.receivedChunks as BlobPart[], { type: file.mime });
      callbacks.onComplete?.(file, blob);
      this.files.delete(msg.id);
      return;
    }

    if (msg.type === 'cancel') {
      this.files.delete(msg.id);
      callbacks.onCancel?.(msg.id);
      return;
    }
  }

  reset(): void {
    this.files.clear();
  }
}

/** Format bytes thành "1.2 MB", "456 KB"... */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Format speed bytes/s → "1.2 MB/s" */
export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

/** Format giây → "1m 23s" hoặc "45s" */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 1) return '< 1s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/** Sinh ID 6 chars dễ đọc (bỏ ký tự dễ nhầm: 0/O, 1/I/l) */
export function generatePeerId(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
