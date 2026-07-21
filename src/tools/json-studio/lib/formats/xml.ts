// ============================================================
// XML parse/stringify - dynamic import `fast-xml-parser`.
// Convention round-trip:
//   - attributes: `@_<name>`
//   - text node:  `#text`
//   - root wrap:  nếu data không có root duy nhất → wrap `<root>...</root>`
//                 Array → `<root><item>...</item></root>`
// Lossy: round-trip có thể đổi shape (xem cảnh báo cho user).
// ============================================================

import type { XMLBuilder, XMLParser } from 'fast-xml-parser';

interface XmlMod {
  XMLParser: typeof XMLParser;
  XMLBuilder: typeof XMLBuilder;
}

let mod: XmlMod | null = null;

async function getXml(): Promise<XmlMod> {
  if (mod) return mod;
  const imported = await import('fast-xml-parser');
  mod = { XMLParser: imported.XMLParser, XMLBuilder: imported.XMLBuilder };
  return mod;
}

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: true,
} as const;

const BUILDER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: true,
} as const;

export async function parseXml(text: string): Promise<unknown> {
  const { XMLParser } = await getXml();
  const parser = new XMLParser(PARSER_OPTIONS);
  const result = parser.parse(text);
  if (result == null || typeof result !== 'object') {
    throw new Error('XML parse trả về giá trị không phải object.');
  }
  return result;
}

export async function stringifyXml(data: unknown): Promise<string> {
  const { XMLBuilder } = await getXml();
  const builder = new XMLBuilder(BUILDER_OPTIONS);
  return builder.build(wrapForXml(data)) as string;
}

/**
 * XML phải có 1 root element. Wrap nếu cần.
 *  - primitive  → { root: value }
 *  - array      → { root: { item: [...] } }
 *  - object có ≥ 2 root keys → { root: data }
 *  - object có 1 root key → giữ nguyên
 */
function wrapForXml(data: unknown): Record<string, unknown> {
  if (data == null || typeof data !== 'object') {
    return { root: data };
  }
  if (Array.isArray(data)) {
    return { root: { item: data } };
  }
  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 1) return obj;
  return { root: obj };
}