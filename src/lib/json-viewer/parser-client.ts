import { parseByFormat } from './formats';
import type { SourceFormat } from './types';

// ============================================================
// Parser Client - facade cho parse các format.
// ============================================================
//
// Quyết định inline (small) hay worker (large):
//   - Text < SYNC_THRESHOLD (~50KB) → parse trực tiếp main thread.
//     Vẫn async (parseByFormat trả Promise vì YAML/XML lazy-import lib),
//     nhưng không qua message channel của worker → đỡ overhead + đỡ
//     bootstrap worker chỉ để parse JSON 5KB.
//   - Text ≥ SYNC_THRESHOLD → gửi sang worker (avoid block main).
//
// Worker là singleton lazy-init (chỉ tạo khi cần lần đầu).
// Mỗi request có id incrementing → response cũ bị bỏ qua nếu đã
// `cancelParseRequest` (request stale).
// ============================================================

const SYNC_THRESHOLD = 50_000;

let workerInstance: Worker | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(new URL('./parser.worker.ts', import.meta.url), {
    type: 'module',
  });

  workerInstance.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const { id, ok } = event.data;
    const pending = pendingRequests.get(id);
    if (!pending) return; // Stale / cancelled — bỏ qua
    pendingRequests.delete(id);
    if (ok) {
      pending.resolve(event.data.data);
    } else {
      pending.reject(new Error(event.data.error));
    }
  };

  workerInstance.onerror = (event) => {
    const err = new Error(event.message || 'Worker crashed');
    for (const pending of pendingRequests.values()) pending.reject(err);
    pendingRequests.clear();
    workerInstance?.terminate();
    workerInstance = null;
  };

  return workerInstance;
}

interface WorkerResponseOk {
  id: number;
  ok: true;
  data: unknown;
}
interface WorkerResponseErr {
  id: number;
  ok: false;
  error: string;
}
type WorkerResponse = WorkerResponseOk | WorkerResponseErr;

/**
 * Parse content → unknown.
 * Sync inline cho input nhỏ, off-thread cho input lớn.
 */
export function parseAsync(
  text: string,
  format: SourceFormat
): { promise: Promise<unknown>; requestId: number } {
  const requestId = nextRequestId++;

  if (text.length < SYNC_THRESHOLD) {
    const promise = parseByFormat(text, format).catch((err) => {
      throw err instanceof Error ? err : new Error('Parse error');
    });
    return { promise, requestId };
  }

  const worker = getWorker();
  const promise = new Promise<unknown>((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    worker.postMessage({ id: requestId, text, format });
  });

  return { promise, requestId };
}

/** Terminate worker + clear pending. Gọi khi rời route để free RAM. */
export function terminateParserWorker(): void {
  workerInstance?.terminate();
  workerInstance = null;
  pendingRequests.clear();
}