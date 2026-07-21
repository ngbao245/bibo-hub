export interface ParsedMeta {
  title: string;
  author: string | null;
}

export function isPdfFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.pdf');
}

export function parseFileMeta(file: File): ParsedMeta {
  const title = file.name
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return { title, author: null };
}