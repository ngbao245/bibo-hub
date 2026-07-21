/// <reference lib="webworker" />
import { parseByFormat } from './formats';
import type { SourceFormat } from './types';

// ============================================================
// Parser Worker - chạy off main thread
// ============================================================
//
// Nhận message từ client: { id, text, format }
// Trả về: { id, ok: true, data } | { id, ok: false, error }
//
// Lý do tách worker:
// - JSON.parse + Papa.parse + YAML parse + XML parse blocking main thread,
//   freeze UI khi data lớn (>1MB).
// - Worker chạy parallel, main thread vẫn responsive cho user gõ/zoom/scroll.
//
// YAML / XML lib trong worker được load lazy qua dynamic import của
// `parseByFormat` → chỉ kéo vào worker bundle khi format đó được dùng.
// ============================================================

type Format = SourceFormat;

interface ParseRequest {
  id: number;
  text: string;
  format: Format;
}

interface ParseResponseOk {
  id: number;
  ok: true;
  data: unknown;
}

interface ParseResponseErr {
  id: number;
  ok: false;
  error: string;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<ParseRequest>) => {
  const { id, text, format } = event.data;
  try {
    const data = await parseByFormat(text, format);
    const response: ParseResponseOk = { id, ok: true, data };
    ctx.postMessage(response);
  } catch (err) {
    const response: ParseResponseErr = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : 'Parse error',
    };
    ctx.postMessage(response);
  }
};

export {};