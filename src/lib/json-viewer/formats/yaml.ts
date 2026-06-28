// ============================================================
// YAML parse/stringify - dynamic import `yaml` để không bump main bundle.
// Lib `yaml` ~30KB gzip, chỉ load khi user thật sự đụng format YAML.
// ============================================================

let mod: typeof import('yaml') | null = null;

async function getYaml(): Promise<typeof import('yaml')> {
  if (mod) return mod;
  mod = await import('yaml');
  return mod;
}

export async function parseYaml(text: string): Promise<unknown> {
  const y = await getYaml();
  return y.parse(text);
}

export async function stringifyYaml(data: unknown): Promise<string> {
  const y = await getYaml();
  // indent 2 spaces, lineWidth 0 = không wrap (giữ string dài 1 dòng).
  return y.stringify(data, { indent: 2, lineWidth: 0 });
}