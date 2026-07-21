// ============================================================
// JSON parse/stringify. Native, không deps.
// ============================================================

export function parseJson(text: string): unknown {
  return JSON.parse(text);
}

export function stringifyJson(data: unknown, pretty = true): string {
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}