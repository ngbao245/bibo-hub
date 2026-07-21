// ============================================================
// TS Bridge — JSON ↔ TypeScript interface ↔ JSON Schema
// ============================================================
//
// Self-roll để tránh dep `quicktype-core` (~500KB gzip). Đơn giản hoá:
//
// JSON → TS:
//   - Recursive walk sample data
//   - Object → interface {…}
//   - Array of same-shape objects → single interface (union nếu shape khác)
//   - Primitive → keyword (string/number/boolean/null)
//   - Auto-generate tên interface từ key (PascalCase). Root = "Root".
//
// TS → JSON Schema:
//   - Regex parse `interface Name { ... }` hoặc `type Name = { ... }`
//   - Field: `name: type` hoặc `name?: type` (optional)
//   - Type support: string/number/boolean/any/array (`Type[]`)/nested identifier
//   - Nested identifier → resolve trong cùng file (2-pass parse)
//   - Union/generic/import → không support (limitation).
// ============================================================

// ================================================================
// JSON → TS
// ================================================================

interface InterfaceDef {
  name: string;
  fields: Array<{ name: string; type: string; optional: boolean }>;
}

export function jsonToTs(data: unknown, rootName = 'Root'): string {
  const defs: InterfaceDef[] = [];
  const nameCounter = new Map<string, number>();

  function makeName(hint: string): string {
    const base = toPascal(hint);
    const n = nameCounter.get(base) ?? 0;
    nameCounter.set(base, n + 1);
    return n === 0 ? base : `${base}${n + 1}`;
  }

  function tsType(v: unknown, hint: string): string {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'boolean') return 'boolean';
    if (Array.isArray(v)) {
      if (v.length === 0) return 'unknown[]';
      // Union of types of first 20 items
      const sample = v.slice(0, 20);
      const itemTypes = new Set(sample.map((item) => tsType(item, hint)));
      if (itemTypes.size === 1) {
        return `${[...itemTypes][0]}[]`;
      }
      return `Array<${[...itemTypes].join(' | ')}>`;
    }
    if (typeof v === 'object') {
      const name = makeName(hint);
      const fields = Object.entries(v as Record<string, unknown>).map(([k, val]) => ({
        name: k,
        type: tsType(val, k),
        optional: val === undefined,
      }));
      defs.push({ name, fields });
      return name;
    }
    return 'unknown';
  }

  tsType(data, rootName);

  // defs push nested trước, root cuối cùng. Reverse để root ở top.
  const orderedDefs = [...defs].reverse();
  return orderedDefs.map(printInterface).join('\n\n');
}

function printInterface(def: InterfaceDef): string {
  const lines = def.fields.map(
    (f) => `  ${isValidIdentifier(f.name) ? f.name : `"${f.name}"`}${f.optional ? '?' : ''}: ${f.type};`
  );
  return `export interface ${def.name} {\n${lines.join('\n')}\n}`;
}

function toPascal(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => (c as string).toUpperCase())
    .replace(/^(.)/, (c) => c.toUpperCase())
    .replace(/^\d/, (c) => `_${c}`);
}

function isValidIdentifier(s: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

// ================================================================
// TS → JSON Schema
// ================================================================

interface ParsedInterface {
  name: string;
  fields: Array<{ name: string; type: string; optional: boolean }>;
}

export function tsToSchema(source: string): object {
  const interfaces = parseInterfaces(source);
  if (interfaces.length === 0) {
    throw new Error('No interface or type found in input.');
  }
  const root = interfaces[0];
  const defs: Record<string, object> = {};
  for (const iface of interfaces) {
    defs[iface.name] = interfaceToSchema(iface, interfaces);
  }
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    ...(defs[root.name] as object),
    definitions: Object.fromEntries(interfaces.slice(1).map((i) => [i.name, defs[i.name]])),
  };
}

function parseInterfaces(source: string): ParsedInterface[] {
  const out: ParsedInterface[] = [];
  // Match `export? interface Name { ... }` hoặc `export? type Name = { ... };`
  const regex = /(?:export\s+)?(?:interface\s+(\w+)\s*(?:extends\s+[\w,\s]+)?\s*\{|type\s+(\w+)\s*=\s*\{)([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source)) !== null) {
    const name = m[1] ?? m[2];
    const body = m[3];
    const fields = parseFields(body);
    out.push({ name, fields });
  }
  return out;
}

function parseFields(body: string): ParsedInterface['fields'] {
  const fields: ParsedInterface['fields'] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim().replace(/[,;]$/, '');
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    const match = /^([\w"'$]+)(\?)?\s*:\s*(.+)$/.exec(trimmed);
    if (!match) continue;
    const name = match[1].replace(/["']/g, '');
    const optional = !!match[2];
    const type = match[3].trim();
    fields.push({ name, type, optional });
  }
  return fields;
}

function interfaceToSchema(iface: ParsedInterface, all: ParsedInterface[]): object {
  const properties: Record<string, object> = {};
  const required: string[] = [];
  for (const f of iface.fields) {
    properties[f.name] = typeToSchema(f.type, all);
    if (!f.optional) required.push(f.name);
  }
  const schema: Record<string, unknown> = {
    type: 'object',
    properties,
  };
  if (required.length > 0) schema.required = required;
  return schema;
}

function typeToSchema(type: string, all: ParsedInterface[]): object {
  const t = type.trim();

  // Array: `Foo[]` hoặc `Array<Foo>`
  const arrMatch = /^(.+?)\[\]$/.exec(t) ?? /^Array<(.+)>$/.exec(t);
  if (arrMatch) {
    return { type: 'array', items: typeToSchema(arrMatch[1], all) };
  }

  // Union: `A | B` → oneOf (simple, không handle nested union)
  if (t.includes('|') && !t.includes('&')) {
    const parts = t.split('|').map((p) => p.trim());
    return { oneOf: parts.map((p) => typeToSchema(p, all)) };
  }

  // Literal string 'foo'
  if (/^['"].*['"]$/.test(t)) {
    return { const: t.slice(1, -1) };
  }

  // Primitives
  if (t === 'string') return { type: 'string' };
  if (t === 'number') return { type: 'number' };
  if (t === 'boolean') return { type: 'boolean' };
  if (t === 'null') return { type: 'null' };
  if (t === 'any' || t === 'unknown') return {};

  // Reference tới interface khác
  const ref = all.find((i) => i.name === t);
  if (ref) return { $ref: `#/definitions/${ref.name}` };

  return { description: `Unsupported: ${t}` };
}