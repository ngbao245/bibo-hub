import { clearNodeSizeCache } from './calculateNodeSize';
import { terminateParserWorker } from './parser-client';

// ============================================================
// Cache maintenance - cleanup mọi in-memory cache của feature json-studio
// ============================================================
//
// Cache đang dùng:
//   1. Node size measurement cache (Map) - calculateNodeSize.ts
//      Đo width/height từng node text bằng DOM. TTL 120s.
//   2. Parser worker (Worker instance) - parser-client.ts
//      Singleton ~30MB RAM, lazy init.
//
// Gọi `clearJsonStudioCaches()` khi route unmount để free RAM.
// Worker sẽ tự lazy init lại lần sau user mở tool.
// Node size cache cũng sẽ tự rebuild khi render lại.
// ============================================================

/** Clear toàn bộ in-memory cache của json-studio feature. */
export function clearJsonStudioCaches(): void {
  clearNodeSizeCache();
  terminateParserWorker();
}