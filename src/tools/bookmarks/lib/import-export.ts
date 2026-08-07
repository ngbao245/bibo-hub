import Papa from 'papaparse';

import type { Bookmark, BookmarkCategory } from '../types';

// ============================================================
// Bookmarks import/export helpers
// ============================================================

export interface ImportedBookmark {
  url: string;
  title: string;
  category: string; // category name (folder name for HTML, string for CSV)
}

// ============================================================
// Export HTML — Netscape bookmark format (compat với Chrome / Firefox)
// ============================================================

export function exportHtml(categories: BookmarkCategory[], bookmarks: Bookmark[]): string {
  const byCat = new Map<string, Bookmark[]>();
  for (const b of bookmarks) {
    const list = byCat.get(b.categoryId) ?? [];
    list.push(b);
    byCat.set(b.categoryId, list);
  }

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const now = Math.floor(Date.now() / 1000);
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const cat of categories) {
    lines.push(`    <DT><H3 ADD_DATE="${now}">${escape(cat.name)}</H3>`);
    lines.push('    <DL><p>');
    for (const b of byCat.get(cat.id) ?? []) {
      lines.push(
        `        <DT><A HREF="${escape(b.url)}" ADD_DATE="${now}">${escape(b.title || b.url)}</A>`,
      );
    }
    lines.push('    </DL><p>');
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}

// ============================================================
// Export CSV
// ============================================================

export function exportCsv(categories: BookmarkCategory[], bookmarks: Bookmark[]): string {
  const catNameById = new Map(categories.map((c) => [c.id, c.name]));
  const rows = bookmarks.map((b) => ({
    url: b.url,
    title: b.title,
    category: catNameById.get(b.categoryId) ?? '',
    note: b.note,
  }));
  return Papa.unparse(rows, { columns: ['url', 'title', 'category', 'note'] });
}

// ============================================================
// Import HTML (Netscape bookmark file)
// ============================================================

export function parseHtml(html: string): ImportedBookmark[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const results: ImportedBookmark[] = [];

  // Traverse DL/DT structure. For simplicity: find all <A> and walk
  // up to nearest preceding H3 (category name) sibling in parent DL.
  const anchors = doc.querySelectorAll('a');
  anchors.forEach((a) => {
    const url = a.getAttribute('href') ?? '';
    if (!/^https?:\/\//i.test(url)) return;
    const title = (a.textContent ?? '').trim() || url;
    const category = findParentCategory(a) ?? 'Imported';
    results.push({ url, title, category });
  });
  return results;
}

function findParentCategory(a: Element): string | null {
  // Walk up: DT > DL > (previous sibling should be DT containing H3 with folder name)
  let node: Element | null = a.parentElement; // DT
  while (node) {
    if (node.tagName === 'DL') {
      const prevDt = node.previousElementSibling;
      if (prevDt) {
        const h3 = prevDt.querySelector('h3');
        if (h3) return (h3.textContent ?? '').trim();
      }
    }
    node = node.parentElement;
  }
  return null;
}

// ============================================================
// Import CSV
// ============================================================

export function parseCsv(csvText: string): { rows: ImportedBookmark[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const errors: string[] = parsed.errors.map((e) => `Row ${e.row ?? '?'}: ${e.message}`);
  const rows: ImportedBookmark[] = [];
  parsed.data.forEach((row, idx) => {
    const url = (row.url ?? '').trim();
    if (!url) {
      errors.push(`Row ${idx + 1}: Missing "url" column`);
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      errors.push(`Row ${idx + 1}: URL "${url}" không hợp lệ`);
      return;
    }
    rows.push({
      url,
      title: (row.title ?? '').trim() || url,
      category: (row.category ?? '').trim() || 'Imported',
    });
  });
  return { rows, errors };
}

// ============================================================
// Download helper
// ============================================================

export function downloadFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
