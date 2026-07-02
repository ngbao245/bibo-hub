// Format markdown qua prettier standalone (browser build) + plugin markdown.
// Lazy-load để không phình bundle của app entry — chỉ pull xuống khi user bấm "Format".

// Prettier standalone chấp nhận `parser: 'markdown'` (GFM). Nó tự chuẩn hoá:
//   - Bảng: mỗi hàng 1 dòng, cột align.
//   - List: bullet/indent nhất quán.
//   - Heading: đảm bảo blank line trước/sau.
//   - Trailing whitespace, escape...
// Không format code fence bên trong (giữ nguyên nội dung).
//
// Prettier YÊU CẦU bảng đã ở dạng multi-line (mỗi row 1 dòng). Nếu user dán bảng
// bị collapse thành 1 dòng (`| A | B | |---|---| | 1 | 2 |`), ta reflow trước.

const PRINT_WIDTH = 100;

let cached: Promise<(md: string) => Promise<string>> | null = null;

async function loadFormatter() {
  if (cached) return cached;
  cached = (async () => {
    const [prettier, markdownPlugin] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/markdown'),
    ]);
    return (md: string) =>
      prettier.format(md, {
        parser: 'markdown',
        plugins: [markdownPlugin.default ?? markdownPlugin],
        printWidth: PRINT_WIDTH,
        proseWrap: 'preserve',
        tabWidth: 2,
      });
  })();
  return cached;
}

/**
 * Reflow bảng GFM bị dán vào 1 dòng thành multi-line.
 * Điều kiện: dòng chứa separator (`|---|---|...`) ở giữa (không phải đầu → cuối).
 * Khi đó lấy số cell từ separator rồi cắt lại header + data rows theo đúng số cell.
 *
 * Edge case: `||` trong content (vd JS operator `passphrase || fallback`) sẽ bị
 * regex coi là 2 pipe boundary. Ta escape `||` (không space giữa) thành placeholder
 * trước khi split, restore sau. `| |` (có space) là empty cell chuẩn, không đụng.
 */
const PIPE_PLACEHOLDER = '\u0001PP\u0001'; // không chứa `|` để không lẫn với cell boundary
const PIPE_PLACEHOLDER_RE = new RegExp(PIPE_PLACEHOLDER, 'g');

function reflowInlineTables(md: string): string {
  // Match nguyên chuỗi separator (>= 1 cell): `| :-? -+ :?- |` lặp lại.
  const sepPattern = /\|(?:\s*:?-+:?\s*\|)+/;

  const lines = md.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const m = sepPattern.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    const sep = m[0];
    // `||` (2 pipe liền, không space) trong content → placeholder để không bị coi là empty cell.
    // Trường hợp cell empty thật (dán bảng `| A |  | B |`) luôn có space giữa 2 pipe.
    const before = line.slice(0, m.index).trimEnd().replace(/\|\|/g, PIPE_PLACEHOLDER);
    const after = line.slice(m.index + sep.length).trimStart().replace(/\|\|/g, PIPE_PLACEHOLDER);

    // Separator ở đúng vị trí riêng 1 dòng → không cần reflow.
    if (!before && !after) {
      out.push(line);
      continue;
    }

    const cellCount = (sep.match(/\|/g)?.length ?? 0) - 1;
    if (cellCount < 1) {
      out.push(line);
      continue;
    }

    // Row = `|` + cellCount cell (mỗi cell: chuỗi không chứa `|` chưa escape, kết thúc `|`).
    // Bắt raw row rồi tự tách cell + escape lại `|` bên trong content thành `\|`
    // (bắt buộc — GFM coi `|` chưa escape là cell boundary khi parse lần 2).
    const cellRe = new RegExp(`([^|]*)\\|`, 'g');
    const rowRe = new RegExp(`\\|(?:[^|]*\\|){${cellCount}}`, 'g');

    const extract = (s: string): string[] => {
      const rows: string[] = [];
      let mm: RegExpExecArray | null;
      while ((mm = rowRe.exec(s)) !== null) {
        const raw = mm[0];
        // Tách thành cellCount cell: bỏ leading `|`, split theo `|`, giữ cellCount phần đầu.
        const inner = raw.slice(1);
        const cells: string[] = [];
        let cm: RegExpExecArray | null;
        cellRe.lastIndex = 0;
        while ((cm = cellRe.exec(inner)) !== null && cells.length < cellCount) {
          const cell = cm[1].replace(PIPE_PLACEHOLDER_RE, '\\|\\|').trim();
          cells.push(cell);
        }
        cellRe.lastIndex = 0;
        rows.push(`| ${cells.join(' | ')} |`);
      }
      rowRe.lastIndex = 0;
      return rows;
    };

    const beforeRows = extract(before);
    const afterRows = extract(after);

    // Cần ít nhất 1 header row phía trước; nếu không match được → giữ nguyên.
    if (beforeRows.length === 0) {
      out.push(line);
      continue;
    }

    out.push(...beforeRows, sep.trim(), ...afterRows);
  }

  return out.join('\n');
}

export async function formatMarkdown(md: string): Promise<string> {
  const preprocessed = reflowInlineTables(md);
  const fmt = await loadFormatter();
  const out = await fmt(preprocessed);
  // Prettier luôn thêm trailing newline; nếu source không có thì cắt cho khớp UX editor.
  return md.endsWith('\n') ? out : out.replace(/\n$/, '');
}