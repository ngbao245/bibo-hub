// Export markdown preview to PDF qua pdfmake — text native, selectable, không rasterize.
// Parse HTML preview → pdfmake content structure. Support heading/paragraph/list/code/
// blockquote/table/link/image/inline formatting (bold/italic/code).

import type {
  Content,
  ContentText,
  TDocumentDefinitions,
  StyleDictionary,
} from 'pdfmake/interfaces';

// ============================================================
// Style tokens — light GitHub-like theme
// ============================================================

const FG_DEFAULT = '#1f2328';
const FG_MUTED = '#59636e';
const ACCENT = '#0969da';
const CODE_INLINE_COLOR = '#c7254e';
const CODE_BLOCK_BG = '#f6f8fa';
const BORDER = '#d1d9e0';

const PDF_STYLES: StyleDictionary = {
  h1: { fontSize: 22, bold: true, margin: [0, 12, 0, 8] as [number, number, number, number] },
  h2: { fontSize: 18, bold: true, margin: [0, 12, 0, 6] as [number, number, number, number] },
  h3: { fontSize: 15, bold: true, margin: [0, 10, 0, 4] as [number, number, number, number] },
  h4: { fontSize: 13, bold: true, margin: [0, 8, 0, 4] as [number, number, number, number] },
  h5: { fontSize: 12, bold: true, margin: [0, 6, 0, 4] as [number, number, number, number] },
  h6: { fontSize: 11, bold: true, color: FG_MUTED, margin: [0, 6, 0, 4] as [number, number, number, number] },
  paragraph: { fontSize: 10.5, margin: [0, 0, 0, 8] as [number, number, number, number], lineHeight: 1.5 },
  // pdfmake default vfs chỉ có Roboto — dùng Roboto bold + màu đỏ cho inline code.
  code: { bold: true, color: CODE_INLINE_COLOR, fontSize: 10 },
  codeBlock: {
    fontSize: 9.5,
    color: FG_DEFAULT,
    margin: [0, 4, 0, 10] as [number, number, number, number],
    lineHeight: 1.4,
  },
  blockquote: {
    fontSize: 10.5,
    color: FG_MUTED,
    italics: true,
    margin: [12, 4, 0, 8] as [number, number, number, number],
  },
  link: { color: ACCENT, decoration: 'underline' },
  listItem: { fontSize: 10.5, margin: [0, 0, 0, 3] as [number, number, number, number], lineHeight: 1.5 },
  tableHeader: { bold: true, fillColor: CODE_BLOCK_BG, fontSize: 10 },
  tableCell: { fontSize: 10 },
};

// ============================================================
// Inline formatting — convert child nodes thành pdfmake text array
// ============================================================

interface InlineContext {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
  link?: string;
  color?: string;
}

function collectInline(
  node: Node,
  ctx: InlineContext = {},
): Array<ContentText | string> {
  const out: Array<ContentText | string> = [];

  const push = (text: string, extra: InlineContext = {}) => {
    if (!text) return;
    const merged = { ...ctx, ...extra };
    const chunk: ContentText = { text };
    if (merged.bold) chunk.bold = true;
    if (merged.italics) chunk.italics = true;
    if (merged.color) chunk.color = merged.color;
    if (merged.link) {
      chunk.link = merged.link;
      chunk.color = ACCENT;
      chunk.decoration = 'underline';
    }
    if (merged.code) {
      chunk.bold = true;
      chunk.color = merged.link ? ACCENT : CODE_INLINE_COLOR;
      chunk.fontSize = 10;
    }
    out.push(chunk);
  };

  if (node.nodeType === Node.TEXT_NODE) {
    push(node.textContent ?? '');
    return out;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return out;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'br':
      out.push({ text: '\n' });
      return out;
    case 'strong':
    case 'b':
      return collectInlineChildren(el, { ...ctx, bold: true });
    case 'em':
    case 'i':
      return collectInlineChildren(el, { ...ctx, italics: true });
    case 'code':
      return collectInlineChildren(el, { ...ctx, code: true });
    case 'a': {
      const href = el.getAttribute('href') ?? '';
      return collectInlineChildren(el, { ...ctx, link: href });
    }
    case 'del':
    case 's':
      return collectInlineChildren(el, { ...ctx }).map((c) => {
        if (typeof c === 'string') return { text: c, decoration: 'lineThrough' } as ContentText;
        return { ...c, decoration: 'lineThrough' } as ContentText;
      });
    default:
      return collectInlineChildren(el, ctx);
  }
}

function collectInlineChildren(el: HTMLElement, ctx: InlineContext): Array<ContentText | string> {
  const out: Array<ContentText | string> = [];
  el.childNodes.forEach((child) => {
    out.push(...collectInline(child, ctx));
  });
  return out;
}

// ============================================================
// Block-level walker — HTML element → pdfmake Content
// ============================================================

function walkBlock(el: HTMLElement): Content[] {
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return [{ text: collectInlineChildren(el, {}), style: tag }];

    case 'p':
      return [{ text: collectInlineChildren(el, {}), style: 'paragraph' }];

    case 'ul':
      return [
        {
          ul: collectListItems(el),
          margin: [0, 0, 0, 8],
        },
      ];

    case 'ol':
      return [
        {
          ol: collectListItems(el),
          margin: [0, 0, 0, 8],
        },
      ];

    case 'pre':
      return [renderCodeBlock(el)];

    case 'blockquote':
      return [renderBlockquote(el)];

    case 'hr':
      return [
        {
          canvas: [
            { type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: BORDER },
          ],
          margin: [0, 6, 0, 10],
        },
      ];

    case 'table':
      return [renderTable(el)];

    case 'img':
      return [];

    case 'div':
    case 'section':
    case 'article':
      return walkChildren(el);

    default:
      return [{ text: collectInlineChildren(el, {}), style: 'paragraph' }];
  }
}

function walkChildren(el: HTMLElement): Content[] {
  const out: Content[] = [];
  Array.from(el.children).forEach((child) => {
    out.push(...walkBlock(child as HTMLElement));
  });
  return out;
}

function collectListItems(listEl: HTMLElement): Content[] {
  const items: Content[] = [];
  Array.from(listEl.children).forEach((li) => {
    if (li.tagName.toLowerCase() !== 'li') return;
    const el = li as HTMLElement;
    const blockChildren = Array.from(el.children).filter((c) => {
      const t = c.tagName.toLowerCase();
      return t === 'ul' || t === 'ol' || t === 'p' || t === 'pre' || t === 'blockquote';
    });

    if (blockChildren.length === 0) {
      items.push({ text: collectInlineChildren(el, {}), style: 'listItem' });
      return;
    }

    // Mixed content: text trước + nested blocks sau.
    const parts: Content[] = [];
    let currentInline: Array<ContentText | string> = [];

    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        currentInline.push(...collectInline(node, {}));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const child = node as HTMLElement;
      const t = child.tagName.toLowerCase();
      const isBlock = t === 'ul' || t === 'ol' || t === 'p' || t === 'pre' || t === 'blockquote';

      if (isBlock) {
        if (currentInline.length) {
          parts.push({ text: currentInline, style: 'listItem' });
          currentInline = [];
        }
        parts.push(...walkBlock(child));
      } else {
        currentInline.push(...collectInline(child, {}));
      }
    });

    if (currentInline.length) {
      parts.push({ text: currentInline, style: 'listItem' });
    }

    items.push({ stack: parts });
  });
  return items;
}

function renderCodeBlock(pre: HTMLElement): Content {
  const code = pre.querySelector('code');
  const text = (code ?? pre).textContent ?? '';
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            text,
            style: 'codeBlock',
            noWrap: false,
            preserveLeadingSpaces: true,
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => BORDER,
      vLineColor: () => BORDER,
      fillColor: () => CODE_BLOCK_BG,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 4, 0, 10],
  };
}

function renderBlockquote(bq: HTMLElement): Content {
  const inline: Array<ContentText | string> = [];
  Array.from(bq.children).forEach((child) => {
    if (child.tagName.toLowerCase() === 'p') {
      inline.push(...collectInlineChildren(child as HTMLElement, {}));
      inline.push('\n');
    }
  });
  return {
    table: {
      widths: ['*'],
      body: [[{ text: inline.length ? inline : bq.textContent ?? '', style: 'blockquote' }]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i: number) => (i === 0 ? 3 : 0),
      vLineColor: () => BORDER,
      paddingLeft: () => 10,
      paddingRight: () => 0,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 4, 0, 10],
  };
}

// Shrink font khi table nhiều cột — pdfmake không auto-scale, tự tính theo colCount.
function tableFontSize(colCount: number): number {
  if (colCount <= 3) return 10;
  if (colCount <= 5) return 9;
  if (colCount <= 7) return 8;
  return 7;
}

function tablePadding(colCount: number): number {
  if (colCount <= 3) return 8;
  if (colCount <= 5) return 6;
  if (colCount <= 7) return 4;
  return 3;
}

// pdfmake chỉ wrap ở whitespace — token dài (URL, package name, CVE list không space)
// gây tràn ngang. Inject zero-width space vào long run để pdfmake break được.
const ZWSP = '\u200B';
function softBreakLongTokens(text: string): string {
  if (!text) return text;
  // Break trước ký tự thường gây token dài: /  -  _  .  :  ,  ;  = 
  // Chỉ break khi run không space > 12 char.
  return text.replace(/[^\s]{12,}/g, (run) => {
    return run.replace(/([\/\-_.:,;=@])/g, `${ZWSP}$1`);
  });
}

function softBreakInline(chunks: Array<ContentText | string>): Array<ContentText | string> {
  return chunks.map((c) => {
    if (typeof c === 'string') return softBreakLongTokens(c);
    return { ...c, text: softBreakLongTokens(c.text as string) };
  });
}

function renderTable(table: HTMLElement): Content {
  const headRows: HTMLTableRowElement[] = Array.from(table.querySelectorAll('thead tr'));
  const bodyRows: HTMLTableRowElement[] = Array.from(table.querySelectorAll('tbody tr'));
  const allRows = headRows.length || bodyRows.length ? [...headRows, ...bodyRows] : Array.from(table.querySelectorAll('tr'));
  if (allRows.length === 0) return { text: '' };

  const rawColCount = Math.max(...allRows.map((tr) => tr.children.length));
  const fontSize = tableFontSize(rawColCount);
  const padding = tablePadding(rawColCount);

  const body: Content[][] = allRows.map((tr, rowIdx) => {
    const cells = Array.from(tr.children) as HTMLElement[];
    return cells.map((cell) => {
      const isHeader = cell.tagName.toLowerCase() === 'th' || (headRows.length > 0 && rowIdx < headRows.length);
      return {
        text: softBreakInline(collectInlineChildren(cell, {})),
        fontSize,
        bold: isHeader,
        fillColor: isHeader ? CODE_BLOCK_BG : undefined,
        noWrap: false,
      } as Content;
    });
  });

  const widths = new Array(rawColCount).fill('*') as Array<'*'>;

  return {
    table: {
      headerRows: headRows.length || 1,
      widths,
      body,
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => BORDER,
      vLineColor: () => BORDER,
      paddingLeft: () => padding,
      paddingRight: () => padding,
      paddingTop: () => padding / 2,
      paddingBottom: () => padding / 2,
    },
    margin: [0, 4, 0, 10],
  };
}

// ============================================================
// Public API
// ============================================================

export async function exportPreviewToPdf(
  previewElement: HTMLElement,
  filename = 'markdown-preview.pdf',
): Promise<void> {
  const inner = previewElement.querySelector<HTMLElement>('.markdown-body');
  if (!inner) throw new Error('markdown-body element not found');

  // pdfmake vfs_fonts.js là UMD IIFE, bind vfs qua `this.pdfMake` (window).
  // Trong Vite ESM `this` = undefined → phải expose pdfMake lên globalThis
  // trước khi import vfs_fonts, IIFE sẽ tự gán vfs.
  const { default: pdfMake } = await import('pdfmake/build/pdfmake');
  (globalThis as unknown as { pdfMake: typeof pdfMake }).pdfMake = pdfMake;
  await import('pdfmake/build/vfs_fonts');

  const content = walkChildren(inner);

  const docDef: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    content,
    styles: PDF_STYLES,
    defaultStyle: {
      fontSize: 10.5,
      color: FG_DEFAULT,
      lineHeight: 1.5,
    },
  };

  return new Promise<void>((resolve, reject) => {
    try {
      pdfMake.createPdf(docDef).download(filename, () => resolve());
    } catch (err) {
      reject(err);
    }
  });
}