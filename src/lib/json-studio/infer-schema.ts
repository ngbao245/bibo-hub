// ============================================================
// Infer JSON Schema từ sample data
// ============================================================
//
// Walk data recursive, build JSON Schema draft-07 tương ứng:
//   - Primitive → { type: 'string' | 'number' | 'boolean' | 'null' }
//   - Object → { type: 'object', properties, required } (mọi key trong sample = required)
//   - Array → { type: 'array', items } (items = union type nếu các phần tử khác nhau)
//
// Bonus format detection cho string:
//   - Match ISO date-time → { format: 'date-time' }
//   - Match email → { format: 'email' }
//   - Match URI → { format: 'uri' }
//   - Match UUID → { format: 'uuid' }
//
// Limitation:
//   - Không detect enum (mặc dù có thể — nhưng cần ≥ 2 samples để confident)
//   - Array items dùng oneOf khi phần tử khác type; union nhiều type có thể verbose
//   - Không infer minLength/maxLength/pattern — user tự thêm nếu cần
// ============================================================

interface InferOptions {
  requireAll?: boolean; // default true — mọi key trong sample = required
  detectFormats?: boolean; // default true
}

export function inferSchema(data: unknown, options: InferOptions = {}): object {
  const { requireAll = true, detectFormats = true } = options;
  const rootSchema = walk(data, { requireAll, detectFormats });
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    ...rootSchema,
  };
}

interface WalkContext {
  requireAll: boolean;
  detectFormats: boolean;
}

function walk(value: unknown, ctx: WalkContext): Record<string, unknown> {
  if (value === null) return { type: 'null' };
  if (value === undefined) return {};

  if (typeof value === 'string') {
    const schema: Record<string, unknown> = { type: 'string' };
    if (ctx.detectFormats) {
      const fmt = detectStringFormat(value);
      if (fmt) schema.format = fmt;
    }
    return schema;
  }

  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' };
  }

  if (typeof value === 'boolean') return { type: 'boolean' };

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { type: 'array', items: {} };
    }
    // Infer schema cho từng element, dedupe theo JSON string
    const itemSchemas = value.slice(0, 20).map((v) => walk(v, ctx));
    const unique = dedupeSchemas(itemSchemas);
    const itemsSchema = unique.length === 1 ? unique[0] : { oneOf: unique };
    return { type: 'array', items: itemsSchema };
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of entries) {
      properties[k] = walk(v, ctx);
      if (ctx.requireAll && v !== undefined) required.push(k);
    }
    const schema: Record<string, unknown> = { type: 'object', properties };
    if (required.length > 0) schema.required = required;
    return schema;
  }

  return {};
}

function dedupeSchemas(schemas: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const s of schemas) {
    const key = JSON.stringify(s);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

// ============================================================
// Format detection regex
// ============================================================
const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RX_URI = /^https?:\/\/[^\s]+$/i;
const RX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RX_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const RX_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RX_TIME = /^\d{2}:\d{2}:\d{2}/;
const RX_IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function detectStringFormat(s: string): string | null {
  if (s.length > 200) return null; // skip long strings
  if (RX_UUID.test(s)) return 'uuid';
  if (RX_EMAIL.test(s)) return 'email';
  if (RX_URI.test(s)) return 'uri';
  if (RX_DATE_TIME.test(s)) return 'date-time';
  if (RX_DATE.test(s)) return 'date';
  if (RX_TIME.test(s)) return 'time';
  if (RX_IPV4.test(s)) return 'ipv4';
  return null;
}