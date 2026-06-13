
// ============================================================
// P2P File Transfer - WebRTC DataChannel protocol
// ============================================================
//
// Mỗi file truyền qua sequence message:
//   1. { type: 'meta', id, name, size, mime, totalChunks }
//   2. N x { type: 'chunk', id, index, data: ArrayBuffer }
//   3. { type: 'done', id }
//
// Chunk size 64KB — safe cho mọi browser WebRTC DataChannel.
//
// Backpressure: check bufferedAmount trên DataChannel, pause khi
// buffer > HIGH_WATER, resume khi < LOW_WATER.
// ============================================================

export const CHUNK_SIZE = 64 * 1024; // 64KB
export const BUFFER_HIGH_WATER = 8 * 1024 * 1024; // 8MB
export const BUFFER_LOW_WATER = 1 * 1024 * 1024;  // 1MB

export type TransferMessage =
  | { type: 'meta'; id: string; name: string; size: number; mime: string; totalChunks: number }
  | { type: 'chunk'; id: string; index: number; data: ArrayBuffer }
  | { type: 'done'; id: string }
  | { type: 'cancel'; id: string };

export interface SendProgress {
  fileId: string;
  fileName: string;
  sent: number;
  total: number;
}

/**
 * Gửi 1 file qua DataChannel.
 * `send` gọi dc.send() — serialize tùy caller.
 * `getBufferedAmount` để backpressure.
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

  // Meta
  send({
    type: 'meta',
    id: fileId,
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
    totalChunks,
  });

  await new Promise((r) => setTimeout(r, 50));

  // Chunks
  let sent = 0;
  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) {
      send({ type: 'cancel', id: fileId });
      throw new Error('Aborted');
    }

    // Backpressure
    if (getBufferedAmount) {
      while (getBufferedAmount() > BUFFER_HIGH_WATER) {
        if (signal?.aborted) throw new Error('Aborted');
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const buf = await file.slice(start, end).arrayBuffer();

    send({ type: 'chunk', id: fileId, index: i, data: buf });
    sent += buf.byteLength;

    if (i % 5 === 0 || i === totalChunks - 1) {
      onProgress?.({ fileId, fileName: file.name, sent, total: file.size });
    }

    if (i % 10 === 9) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  send({ type: 'done', id: fileId });
}

// ============================================================
// Receiver
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
      if (file.receivedChunks[msg.index]) return;
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
    }
  }

  reset(): void {
    this.files.clear();
  }
}

// ============================================================
// ICE Servers config — Metered TURN
// ============================================================
//
// Credential (username/credential) được nạp động từ Setting tool
// (group "P2P", type "TURN Server Metered"). URL hardcode 2 dòng
// vì chỉ dùng path turn:tcp/443 + turns:tcp/443.
// ============================================================

import { loadP2PConfig } from './loadP2PConfig';

/** ICE servers — chỉ TURN over TLS:443 để bypass UDP block */
export async function getIceServers(): Promise<RTCIceServer[]> {
  const { turn } = await loadP2PConfig();
  return [
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: turn.username,
      credential: turn.credential,
    },
    {
      urls: 'turn:global.relay.metered.ca:443?transport=tcp',
      username: turn.username,
      credential: turn.credential,
    },
  ];
}

// ============================================================
// Utilities
// ============================================================

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 1) return '< 1s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export function generatePeerId(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}