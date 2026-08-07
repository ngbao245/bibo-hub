// ============================================================
// PDF Studio Edit PDF — Text detection and grouping
// ============================================================
// Reads text layer from pdf.js, groups items into logical regions
// (line-first, then block by alignment/spacing).
// All coordinates in PDF page space (points, origin bottom-left).
// ============================================================

import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface TextRegion {
  id: string;
  pageIndex: number;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize: number;
  fontFamily: string;
  items: TextItemInfo[];
}

interface TextItemInfo {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
}

// ─── Main detection function ─────────────────────────────────

export async function detectTextRegions(
  pdfDoc: PDFDocumentProxy,
  pageIndices?: number[],
): Promise<TextRegion[]> {
  const regions: TextRegion[] = [];
  const pagesToProcess = pageIndices ?? Array.from({ length: pdfDoc.numPages }, (_, i) => i);

  for (const pageIdx of pagesToProcess) {
    const page = await pdfDoc.getPage(pageIdx + 1); // pdf.js is 1-indexed
    const textContent = await page.getTextContent();
    const pageHeight = page.getViewport({ scale: 1 }).height;

    const items: TextItemInfo[] = [];

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const typedItem = item as {
        str: string;
        transform: number[];
        width: number;
        height: number;
        fontName: string;
      };

      // transform[4] = x, transform[5] = y (bottom-left origin)
      const x = typedItem.transform[4];
      const y = typedItem.transform[5];
      const fontSize = Math.abs(typedItem.transform[3]) || Math.abs(typedItem.transform[0]) || 12;

      items.push({
        str: typedItem.str,
        x,
        y,
        width: typedItem.width,
        height: Math.max(typedItem.height || 0, fontSize * 1.4),
        fontName: typedItem.fontName,
        fontSize,
      });
    }

    // Group items into lines then blocks
    const grouped = groupIntoRegions(items, pageIdx, pageHeight);
    regions.push(...grouped);
  }

  return regions;
}

// ─── Grouping algorithm ──────────────────────────────────────

function groupIntoRegions(items: TextItemInfo[], pageIndex: number, pageHeight: number): TextRegion[] {
  if (items.length === 0) return [];

  // Sort by Y descending (top of page first in visual order), then X ascending
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 3) return yDiff; // different line
    return a.x - b.x; // same line, left to right
  });

  // Step 1: Group into lines (items with similar Y within tolerance)
  const lines: TextItemInfo[][] = [];
  let currentLine: TextItemInfo[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentLine[0];
    const curr = sorted[i];
    const yTolerance = Math.max(prev.fontSize, curr.fontSize) * 0.5;

    if (Math.abs(curr.y - prev.y) <= yTolerance) {
      currentLine.push(curr);
    } else {
      lines.push(currentLine);
      currentLine = [curr];
    }
  }
  lines.push(currentLine);

  // Step 2: Each line becomes its own region (spec: prioritize lines, user can resize)
  const regions: TextRegion[] = [];
  for (const line of lines) {
    regions.push(createRegionFromBlock([line], pageIndex, pageHeight));
  }

  return regions;
}

function createRegionFromBlock(blockLines: TextItemInfo[][], pageIndex: number, pageHeight: number): TextRegion {
  const allItems = blockLines.flat();
  const minX = Math.min(...allItems.map((it) => it.x));
  const maxX = Math.max(...allItems.map((it) => it.x + it.width));
  // Items are in PDF bottom-left origin; convert bounds to top-left origin.
  const minYbl = Math.min(...allItems.map((it) => it.y)); // baseline lowest
  const maxYbl = Math.max(...allItems.map((it) => it.y + it.height)); // top-most in bottom-left
  const content = blockLines.map((line) => line.map((it) => it.str).join(' ')).join('\n');
  const avgFontSize = allItems.reduce((sum, it) => sum + it.fontSize, 0) / allItems.length;
  const fontFamily = allItems[0]?.fontName ?? 'Helvetica';

  const width = maxX - minX;
  const height = maxYbl - minYbl;
  // Top-left Y = distance from page top to the region's top edge
  const topLeftY = pageHeight - maxYbl;

  return {
    id: `region-${pageIndex}-${Math.random().toString(36).slice(2, 8)}`,
    pageIndex,
    pageId: `page-${pageIndex}`,
    x: minX,
    y: topLeftY,
    width,
    height,
    content,
    fontSize: avgFontSize,
    fontFamily,
    items: allItems,
  };
}

// ─── Check if page has text layer ────────────────────────────

export async function hasTextLayer(pdfDoc: PDFDocumentProxy, pageIndex: number): Promise<boolean> {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const textContent = await page.getTextContent();
  const hasItems = textContent.items.some(
    (item) => 'str' in item && (item as { str: string }).str.trim().length > 0,
  );
  return hasItems;
}
