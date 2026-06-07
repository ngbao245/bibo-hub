import { useEffect, useMemo, useRef, useState } from 'react';
import { Package, RotateCcw, FolderOpen, ChevronRight, ChevronDown, File as FileIcon, Archive, Download } from 'lucide-react';
import { PackerLoadingSpinner } from './PackerLoadingSpinner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';
import { toast } from '@/components/ui/sonner';

import TerminalLog from './TerminalLog';
import PartOutput from './PartOutput';
import PackerOptions from './PackerOptions';

import { isExcluded, isExtensionAllowed } from '@/lib/packer/filter';
import { PRESETS } from '@/lib/packer/presets';
import { readFiles, packFiles } from '@/lib/packer/pack';
import { downloadBlob } from '@/lib/packer/unpack';
import type { LogEntry, PackOptions, PackPart } from '@/lib/packer/types';

// ============================================================
// PackPanel - hiển thị cây thư mục, không crash
// ============================================================
//
// Tránh crash bằng cách:
// 1. File[] lưu trong useRef (KHÔNG vào React state) → không trigger re-render khổng lồ
// 2. Tree state chỉ chứa metadata (path, type) → nhẹ
// 3. Lazy render: folder collapsed → không render children
// ============================================================

const REACT_PRESET = PRESETS[0];
const DEFAULT_OPTIONS: PackOptions = {
  maxCharsPerPart: 50_000,
  excludePatterns: REACT_PRESET.excludePatterns,
  includeExtensions: REACT_PRESET.includeExtensions,
};

const HIDDEN_FOLDERS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.vite',
  '.turbo', 'coverage', '.cache', '.parcel-cache', '.idea', '.vscode',
]);

// ============================================================
// Drag-drop traverse — skip HIDDEN_FOLDERS NGAY tại folder entry
// (tận dụng webkitGetAsEntry — KHÔNG scan node_modules)
// ============================================================
async function traverseEntry(
  entry: FileSystemEntry,
  parentPath: string,
  out: { file: File; path: string }[],
): Promise<void> {
  // Skip ngay nếu folder name nằm trong blacklist → không vào!
  if (entry.isDirectory && HIDDEN_FOLDERS.has(entry.name)) return;

  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) => {
      (entry as FileSystemFileEntry).file(resolve, () => resolve(null));
    });
    if (file) out.push({ file, path });
    return;
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries chỉ trả max 100 entries 1 lần, phải loop
    const entries: FileSystemEntry[] = [];
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      if (batch.length === 0) break;
      entries.push(...batch);
    }
    for (const e of entries) {
      await traverseEntry(e, path, out);
    }
  }
}

// ============================================================
// Tree types
// ============================================================
interface TreeNode {
  name: string;          // tên file/folder
  path: string;          // full path từ root
  isFolder: boolean;
  children: TreeNode[];  // chỉ folder mới có children
  fileCount: number;     // tổng số file con (folder), 1 (file)
  descendantPaths: string[]; // cache: tất cả path con (cho toggle nhanh)
}

async function buildTree(paths: string[]): Promise<TreeNode> {
  const root: TreeNode = { name: '', path: '', isFolder: true, children: [], fileCount: 0, descendantPaths: [] };
  const map = new Map<string, TreeNode>();
  map.set('', root);

  for (let idx = 0; idx < paths.length; idx++) {
    // Yield mỗi 1000 paths để main thread không block
    if (idx % 1000 === 0 && idx > 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
    const path = paths[idx];
    const parts = path.split('/');
    let parent = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${name}` : name;

      let node = map.get(currentPath);
      if (!node) {
        node = {
          name,
          path: currentPath,
          isFolder: !isLast,
          children: [],
          fileCount: 0,
          descendantPaths: [],
        };
        map.set(currentPath, node);
        parent.children.push(node);
      }
      parent = node;
    }
  }

  // Tính fileCount + descendantPaths đệ quy + sort folder trước file
  function compute(node: TreeNode): number {
    if (!node.isFolder) {
      node.fileCount = 1;
      node.descendantPaths = [node.path];
      return 1;
    }
    let total = 0;
    const allPaths: string[] = [node.path];
    for (const child of node.children) {
      total += compute(child);
      allPaths.push(...child.descendantPaths);
    }
    node.fileCount = total;
    node.descendantPaths = allPaths;
    // Sort: folder trước, sau đó alphabet
    node.children.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return total;
  }
  compute(root);
  return root;
}

// ============================================================
// PackPanel
// ============================================================
export default function PackPanel() {
  // File objects giữ trong ref — KHÔNG vào state
  const filesRef = useRef<{ file: File; path: string }[]>([]);

  // State chỉ chứa data nhẹ
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<PackOptions>(DEFAULT_OPTIONS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPacking, setIsPacking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; path: string } | null>(null);
  const [parts, setParts] = useState<PackPart[]>([]);
  // Loading indicator cho các thao tác nặng (scan, toggle, zip)
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const logIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Progress hiển thị (smooth animated). Khác với `progress.current` là raw value.
  const [displayProgress, setDisplayProgress] = useState(0);

  // Tween displayProgress về `progress.current` mỗi animation frame
  useEffect(() => {
    if (!progress || progress.total === 0) {
      setDisplayProgress(0);
      return;
    }
    const target = (progress.current / progress.total) * 100;
    let raf = 0;
    function tick() {
      setDisplayProgress((current) => {
        const diff = target - current;
        if (Math.abs(diff) < 0.1) return target;
        // Ease: di chuyển 8% khoảng cách mỗi frame → mượt + đuổi kịp
        return current + diff * 0.08;
      });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  function log(message: string, type: LogEntry['type'] = 'info') {
    setLogs((prev) => [
      ...prev,
      { id: ++logIdRef.current, message, type, timestamp: new Date() },
    ]);
  }

  function reset() {
    filesRef.current = [];
    setTree(null);
    setSelectedPaths(new Set());
    setLogs([]);
    setParts([]);
    setIsPacking(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  // ============================================================
  // Download all parts as 1 ZIP (chứa nhiều .txt files)
  // ============================================================
  async function handleDownloadAllAsZip(parts: PackPart[]) {
    if (parts.length === 0) return;
    setBusyMessage(`Đang tạo ZIP với ${parts.length} part...`);
    await new Promise((r) => setTimeout(r, 0));
    try {
      // Lazy import JSZip
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      const padLen = String(parts.length).length;
      for (const part of parts) {
        const filename =
          parts.length === 1
            ? 'project-packed.txt'
            : `project-packed-part-${String(part.index).padStart(padLen, '0')}.txt`;
        zip.file(filename, part.content);
      }

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 3 }, // level thấp = nén nhanh, ít block CPU
      });

      downloadBlob(blob, 'project-packed.zip');
      toast.success(`Đã tải ZIP (${(blob.size / 1024).toFixed(1)} KB)`);
      // Hiển thị thông báo reload, sau 1.5s reload page
      setBusyMessage('Đã tải xong. Đang reload để clear cache...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      return; // KHÔNG vào finally để giữ busyMessage tới khi reload
    } catch (e) {
      toast.error('Không tạo được ZIP');
      log(`Lỗi tạo ZIP: ${String(e)}`, 'error');
      setBusyMessage(null);
    }
  }

  // Download mỗi part thành file .txt riêng (loop downloadBlob)
  function handleDownloadAllAsTxt(parts: PackPart[]) {
    const padLen = String(parts.length).length;
    for (const part of parts) {
      const filename =
        parts.length === 1
          ? 'project-packed.txt'
          : `project-packed-part-${String(part.index).padStart(padLen, '0')}.txt`;
      const blob = new Blob([part.content], { type: 'text/plain' });
      downloadBlob(blob, filename);
    }
    toast.success(`Đã tải ${parts.length} file .txt`);
    setBusyMessage('Đã tải xong. Đang reload để clear cache...');
    setTimeout(() => window.location.reload(), 1500);
  }

  // ============================================================
  // Folder input — scan tên, build tree, KHÔNG đọc content
  // ============================================================
  async function handleFolderInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) {
      setBusyMessage(null);
      return;
    }

    setBusyMessage(`Đang xử lý ${files.length.toLocaleString('vi-VN')} file...`);
    // Yield để UI render busy message trước khi block
    await new Promise((r) => setTimeout(r, 0));

    // Filter hidden folders
    const filtered = files
      .map((f) => ({ file: f, path: f.webkitRelativePath || f.name }))
      .filter(({ path }) => {
        const parts = path.split('/');
        return !parts.some((p) => HIDDEN_FOLDERS.has(p));
      });

    // Lưu File[] vào ref (KHÔNG vào state)
    filesRef.current = filtered;

    // Build tree (chỉ paths) — async, yield mỗi 1000 paths
    const paths = filtered.map((f) => f.path);
    const newTree = await buildTree(paths);

    // Auto-select tất cả paths. Tách 2 setState bằng yield để React render mượt.
    setTree(newTree);
    await new Promise((r) => setTimeout(r, 0));
    setSelectedPaths(new Set(paths));
    setParts([]);
    setLogs([{
      id: ++logIdRef.current,
      message: `Đã quét ${filtered.length} file`,
      type: 'info',
      timestamp: new Date(),
    }]);
    setBusyMessage(null);
  }

  // ============================================================
  // Pack — đọc content files đã chọn
  // ============================================================
  async function handlePack() {
    setIsPacking(true);
    setParts([]);
    setLogs([]);
    setProgress({ current: 0, total: 0, path: '' });

    // Scroll tới progress bar sau khi DOM render
    requestAnimationFrame(() => {
      progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Lấy file từ ref, lọc theo selectedPaths + filter.
    // Detect root prefix (nếu có): tất cả path cùng share segment đầu thì đó là root.
    const sample = filesRef.current[0]?.path ?? '';
    const firstSegment = sample.split('/')[0];
    const hasRootPrefix =
      filesRef.current.length > 1 &&
      firstSegment.length > 0 &&
      filesRef.current.every((f) => f.path.startsWith(firstSegment + '/'));
    const stripRoot = (path: string): string =>
      hasRootPrefix ? path.split('/').slice(1).join('/') : path;

    // Log chi tiết file bị filter để user biết tại sao bị loại.
    const filteredOut: { path: string; reason: string }[] = [];
    const toRead = filesRef.current.filter((f) => {
      if (!selectedPaths.has(f.path)) return false;
      const relativePath = stripRoot(f.path);

      if (isExcluded(relativePath, options.excludePatterns)) {
        filteredOut.push({ path: f.path, reason: 'exclude pattern' });
        return false;
      }
      if (!isExtensionAllowed(relativePath, options.includeExtensions)) {
        filteredOut.push({ path: f.path, reason: 'extension không trong include list' });
        return false;
      }
      return true;
    });

    // Log file bị filter (giới hạn 30 dòng để không spam)
    if (filteredOut.length > 0) {
      log(`Filter: ${filteredOut.length} file bị loại (xem chi tiết bên dưới)`, 'warning');
      for (const f of filteredOut.slice(0, 30)) {
        log(`  ✗ ${f.path} — ${f.reason}`, 'warning');
      }
      if (filteredOut.length > 30) {
        log(`  ... và ${filteredOut.length - 30} file khác`, 'warning');
      }
    }

    setProgress({ current: 0, total: toRead.length, path: '' });
    log(`Bắt đầu đọc ${toRead.length} file...`);

    const { files: packedFiles, failed } = await readFiles(
      toRead.map((f) => ({ file: f.file, path: stripRoot(f.path) })),
      (p) => {
        setProgress({ current: p.current, total: p.total, path: p.currentPath });
        if (p.current % 50 === 0 || p.current === p.total) {
          log(`Đọc ${p.current}/${p.total}: ${p.currentPath}`);
        }
      },
    );

    for (const f of failed.slice(0, 20)) {
      log(`Bỏ qua: ${f.path} (${f.reason})`, 'warning');
    }
    if (failed.length > 20) log(`... và ${failed.length - 20} file khác bị bỏ qua`, 'warning');

    if (packedFiles.length === 0) {
      log('Không đọc được file nào!', 'error');
      setIsPacking(false);
      setProgress(null);
      return;
    }

    log(`Đã đọc ${packedFiles.length} file. Đang chia parts...`);
    setProgress({ current: packedFiles.length, total: packedFiles.length, path: 'Đang chia parts...' });
    const result = await packFiles(packedFiles, options);
    log(`✓ Xong! ${result.length} part`, 'success');

    setParts(result);
    setIsPacking(false);
    setProgress(null);
  }

  // Đếm file đã chọn (chỉ file, không folder paths)
  const selectedFileCount = useMemo(() => {
    if (!tree) return 0;
    let count = 0;
    for (const path of selectedPaths) {
      // Kiểm tra path có phải là file không (không có path nào khác bắt đầu bằng path/)
      const isFile = filesRef.current.some((f) => f.path === path);
      if (isFile) count++;
    }
    return count;
  }, [tree, selectedPaths]);

  return (
    <div className="space-y-3">
      {/* Loading overlay khi xử lý nặng */}
      {busyMessage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3 border border-border bg-card px-6 py-4 shadow-lg">
            <PackerLoadingSpinner />
            <span className="text-sm font-medium text-foreground">{busyMessage}</span>
          </div>
        </div>
      )}

      {!tree && (
        <div
          onClick={() => {
            // Hiển thị busy ngay vì browser sẽ block UI khi scan folder lớn
            setBusyMessage('Đang mở dialog chọn folder...');
            inputRef.current?.click();
            // Browser scan folder rồi gọi handleFolderInput. Nếu user cancel,
            // onChange không chạy → busy stuck. Auto-clear sau 30s nếu chưa clear.
            setTimeout(() => {
              setBusyMessage((m) => m === 'Đang mở dialog chọn folder...' ? null : m);
            }, 30000);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('border-primary', 'bg-popover');
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('border-primary', 'bg-popover');
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-primary', 'bg-popover');
            setBusyMessage('Đang quét thư mục...');
            await new Promise((r) => setTimeout(r, 0));
            const items = Array.from(e.dataTransfer.items);
            const collected: { file: File; path: string }[] = [];
            for (const item of items) {
              const entry = item.webkitGetAsEntry?.();
              if (entry) await traverseEntry(entry, '', collected);
            }
            if (collected.length > 0) {
              filesRef.current = collected;
              const paths = collected.map((f) => f.path);
              const built = await buildTree(paths);
              setTree(built);
              await new Promise((r) => setTimeout(r, 0));
              setSelectedPaths(new Set(paths));
              setParts([]);
              setLogs([{
                id: ++logIdRef.current,
                message: `Đã quét ${collected.length} file (drag-drop)`,
                type: 'info',
                timestamp: new Date(),
              }]);
            }
            setBusyMessage(null);
          }}
          className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-border bg-card py-10 text-center transition-colors hover:border-primary hover:bg-popover"
        >
          <FolderOpen className="mb-2 h-8 w-8 text-primary" />
          <p className="text-sm font-medium text-foreground">Kéo-thả thư mục vào đây</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hoặc click để chọn (kéo-thả nhanh hơn, không bị lag với project lớn)
          </p>
          <p className="mt-2 text-[10px] text-yellow-500/80">
            ⚠ Click chọn folder có thể lag nếu project lớn
          </p>
          <input
            ref={inputRef}
            type="file"
            // @ts-expect-error webkitdirectory
            webkitdirectory="true"
            directory="true"
            multiple
            className="hidden"
            onChange={handleFolderInput}
          />
        </div>
      )}

      {tree && (
        <>
          <PackerOptions options={options} onChange={setOptions} />

          {/* Tree */}
          <div className="border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cây thư mục — {selectedFileCount}/{tree.fileCount} file đã chọn
              </span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setBusyMessage('Đang chọn tất cả...');
                    await new Promise((r) => setTimeout(r, 0));
                    const all = new Set<string>();
                    function collect(node: TreeNode) {
                      all.add(node.path);
                      for (const c of node.children) collect(c);
                    }
                    for (const c of tree.children) collect(c);
                    setSelectedPaths(all);
                    setBusyMessage(null);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Chọn tất cả
                </button>
                <button
                  onClick={async () => {
                    setBusyMessage('Đang bỏ chọn...');
                    await new Promise((r) => setTimeout(r, 0));
                    setSelectedPaths(new Set());
                    setBusyMessage(null);
                  }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto p-1 text-xs">
              {tree.children.map((node) => (
                <TreeNodeView
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedPaths={selectedPaths}
                  onToggle={(paths, checked) => {
                    setSelectedPaths((prev) => {
                      const next = new Set(prev);
                      for (const p of paths) {
                        if (checked) next.add(p);
                        else next.delete(p);
                      }
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border border-border bg-card px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {selectedFileCount} file sẽ được pack
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handlePack}
                disabled={isPacking || selectedFileCount === 0}
                className="gap-1.5"
              >
                {isPacking ? (
                  <PackerLoadingSpinner size="sm" />
                ) : (
                  <Package className="h-3 w-3" />
                )}
                {isPacking ? 'Đang pack...' : 'Pack'}
              </Button>
            </div>
          </div>

          <TerminalLog logs={logs} />

          {/* Progress bar khi đang pack */}
          {isPacking && progress && (
            <div ref={progressRef} className="border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  {progress.total > 0 ? `${progress.current}/${progress.total} file` : 'Đang chuẩn bị...'}
                </span>
                <span className="text-primary font-mono">
                  {progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : ''}
                </span>
              </div>
              <div className="h-2 w-full bg-background overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: progress.total > 0 ? `${displayProgress}%` : '5%',
                  }}
                />
              </div>
              {progress.path && (
                <p className="truncate text-[10px] text-muted-foreground font-mono">
                  → {progress.path}
                </p>
              )}
            </div>
          )}

          {parts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-border bg-card px-3 py-2 text-xs">
                <span>
                  Output: <span className="font-semibold">{parts.length}</span> part ·{' '}
                  Tổng <span className="font-semibold">
                    {parts.reduce((s, p) => s + p.charCount, 0).toLocaleString('vi-VN')}
                  </span> ký tự
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleDownloadAllAsZip(parts)}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    <Archive className="h-3 w-3" />
                    Tải ZIP ({parts.length} parts)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadAllAsTxt(parts)}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    <Download className="h-3 w-3" />
                    Tải .txt riêng
                  </Button>
                </div>
              </div>
              {parts.map((p) => (
                <PartOutput key={p.index} part={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// TreeNodeView - render 1 node, lazy children (collapsed mặc định nếu > 50 children)
// ============================================================
function TreeNodeView({
  node,
  depth,
  selectedPaths,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  selectedPaths: Set<string>;
  onToggle: (paths: string[], checked: boolean) => void;
}) {
  // Folder lớn (>30 children) collapsed mặc định
  const [collapsed, setCollapsed] = useState(node.children.length > 30);

  if (!node.isFolder) {
    // File row
    return (
      <label
        className={cn(
          'flex cursor-pointer items-center gap-1.5 py-0.5 hover:bg-popover/50',
          !selectedPaths.has(node.path) && 'opacity-50',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <Checkbox
          checked={selectedPaths.has(node.path)}
          onCheckedChange={(checked) => onToggle([node.path], !!checked)}
          className="h-3 w-3"
        />
        <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate text-foreground">{node.name}</span>
      </label>
    );
  }

  // Folder row — dùng cache descendantPaths đã compute lúc buildTree
  const allDescendants = node.descendantPaths;
  const checkedCount = allDescendants.filter((p) => selectedPaths.has(p)).length;
  const isAllChecked = checkedCount === allDescendants.length;
  const isPartial = checkedCount > 0 && !isAllChecked;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 hover:bg-popover/50"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <Checkbox
          checked={isAllChecked}
          ref={(el) => {
            // Indeterminate state cho partial select
            if (el) {
              const input = el as HTMLButtonElement & { indeterminate?: boolean };
              input.indeterminate = isPartial;
            }
          }}
          onCheckedChange={(checked) => onToggle(allDescendants, !!checked)}
          className="h-3 w-3"
        />
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1"
        >
          <FolderOpen className="h-3 w-3 text-primary" />
          <span className="font-medium text-foreground">{node.name}/</span>
          <span className="text-muted-foreground">({node.fileCount})</span>
        </button>
      </div>

      {!collapsed && (
        <div>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPaths={selectedPaths}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
