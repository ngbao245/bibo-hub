// ============================================================
// File filter - quyết định file nào được pack
// ============================================================
//
// 2 tiêu chí:
// 1. Path không match exclude pattern
// 2. (Optional) Extension nằm trong include list
//
// Pattern hỗ trợ:
// - "node_modules/" — match thư mục
// - "*.lock"        — match extension
// - "package-lock.json" — match exact filename
// - ".env*"         — wildcard prefix
// ============================================================

/** Match 1 path với 1 pattern (gitignore-like đơn giản) */
function matchPattern(path: string, pattern: string): boolean {
  // Folder match: "node_modules/" → bất kỳ path nào chứa "/node_modules/" hoặc bắt đầu bằng
  if (pattern.endsWith('/')) {
    const folder = pattern.slice(0, -1);
    return (
      path === folder ||
      path.startsWith(folder + '/') ||
      path.includes('/' + folder + '/')
    );
  }

  // Wildcard: "*.lock", ".env*"
  if (pattern.includes('*')) {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$',
    );
    const filename = path.split('/').pop() ?? '';
    return regex.test(filename) || regex.test(path);
  }

  // Exact filename match
  const filename = path.split('/').pop() ?? '';
  return filename === pattern || path === pattern || path.endsWith('/' + pattern);
}

/** Trả về true nếu path bị loại trừ */
export function isExcluded(path: string, excludePatterns: string[]): boolean {
  return excludePatterns.some((p) => matchPattern(path, p));
}

/** Trả về true nếu extension được phép. Nếu list rỗng, cho phép tất cả. */
export function isExtensionAllowed(path: string, includeExtensions: string[]): boolean {
  if (includeExtensions.length === 0) return true;
  const filename = path.split('/').pop() ?? '';

  // File không có extension (vd: ".gitignore", "Dockerfile"):
  // chỉ cho phép nếu có trong list dạng exact match
  if (!filename.includes('.')) {
    return includeExtensions.includes(filename);
  }

  return includeExtensions.some((ext) => {
    // Cho phép ext có hoặc không có dấu chấm: ".tsx" hoặc "tsx"
    const normalized = ext.startsWith('.') ? ext : '.' + ext;
    return filename.endsWith(normalized);
  });
}

/**
 * Filter mảng path theo exclude + include rules.
 * Return: { kept, excluded } để UI hiển thị file nào bị bỏ qua.
 */
export function filterPaths(
  paths: string[],
  excludePatterns: string[],
  includeExtensions: string[],
): { kept: string[]; excluded: string[] } {
  const kept: string[] = [];
  const excluded: string[] = [];

  for (const p of paths) {
    if (isExcluded(p, excludePatterns) || !isExtensionAllowed(p, includeExtensions)) {
      excluded.push(p);
    } else {
      kept.push(p);
    }
  }
  return { kept, excluded };
}
