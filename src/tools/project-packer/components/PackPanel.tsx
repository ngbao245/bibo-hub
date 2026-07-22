import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Package, RotateCcw, FolderOpen, ChevronRight, ChevronDown, File as FileIcon, Archive, Download } from 'lucide-react';
import { PackerLoadingSpinner } from './PackerLoadingSpinner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';
import { toast } from '@/components/ui/sonner';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import TerminalLog from './TerminalLog';
import PartOutput from './PartOutput';
import PackerOptions from './PackerOptions';

import { isExcluded, isExtensionAllowed } from '@/tools/project-packer/lib/filter';
import { PRESETS } from '@/tools/project-packer/lib/presets';
import { readFiles, packFiles, LARGE_FILE_WHITELIST } from '@/tools/project-packer/lib/pack';
import { downloadBlob } from '@/tools/project-packer/lib/unpack';
import type { LogEntry, PackOptions, PackPart } from '@/tools/project-packer/lib/types';

// ============================================================
// PackPanel - hiển thị cây thư mục, không crash
// ============================================================
//
// Tránh crash bằng cách:
// 1. File[] lưu trong useRef (KHÔNG vào React state) → không trigger re-render không lỗi
// 2. Tree state chỉ chứa metadata (path, type) → nhẹ
// 3. Lazy render: folder collapsed → không render children
//
// Persist (cứu khi crash):
// - Options: localStorage 'packer.options'
// - Selection paths: localStorage 'packer.selectedPaths'
//   → user mở folder lß║íi, app tự restore tick từ paths cũ.
// ============================================================

const REACT_PRESET = PRESETS[0];
const DEFAULT_OPTIONS: PackOptions = {
  maxCharsPerPart: 50_000,
  excludePatterns: REACT_PRESET.excludePatterns,
  includeExtensions: REACT_PRESET.includeExtensions,
};

const LS_OPTIONS = 'packer.options';
const LS_SELECTED_PATHS = 'packer.selectedPaths';

const HIDDEN_FOLDERS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.vite',
  '.turbo', 'coverage', '.cache', '.parcel-cache', '.idea', '.vscode',
]);

// ============================================================
// Drag-drop traverse — skip HIDDEN_FOLDERS NGAY tại folder entry
// (tận dụng webkitGetAsEntry — KH├öNG scan node_modules)
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
  name: string;          // t├¬n file/folder
  path: string;          // full path từ root
  isFolder: boolean;
  children: TreeNode[];  // chỉ folder mới có children
  fileCount: number;     // tổng số file con (folder), 1 (file)
  descendantPaths: string[]; // cache: tất cả path con (cho toggle nhanh)
}

/**
 * Selection store — Set<string> + per-path subscriptions.
 *
 * Lừ do KH├öNG dùng React state cho selectedPaths:
 *   - Mỗi tick → setState → re-render TOÀN BỘ tree (5000 row).
 *   - Mỗi folder phải re-compute count = O(descendants) ├ù O(folders) = O(n²).
 *
 * Cách dùng: row subscribe vào path của mình, chỉ row đó re-render.
 * Folder count vẫn là O(descendants) NHƯNG chỉ chạy khi count đổi
 * (không phải mỗi setState).
 */
class SelectionStore {
  private set: Set<string>;
  private listeners = new Map<string, Set<() => void>>();
  private allListeners = new Set<() => void>();

  constructor(initial: Iterable<string>) {
    this.set = new Set(initial);
  }

  has(path: string): boolean {
    return this.set.has(path);
  }

  /** Snapshot toàn bộ — dùng để persist localStorage hoặc count. */
  getAll(): string[] {
    return [...this.set];
  }

  size(): number {
    return this.set.size;
  }

  /** Toggle nhiều path 1 lần, fire chỉ nhß╗»ng path đổi. */
  toggle(paths: string[], checked: boolean) {
    const changed: string[] = [];
    for (const p of paths) {
      const has = this.set.has(p);
      if (checked && !has) {
        this.set.add(p);
        changed.push(p);
      } else if (!checked && has) {
        this.set.delete(p);
        changed.push(p);
      }
    }
    if (changed.length === 0) return;
    // Notify per-path listeners
    for (const p of changed) {
      this.listeners.get(p)?.forEach((cb) => cb());
    }
    // Notify all listeners (cho folder count, panel summary)
    this.allListeners.forEach((cb) => cb());
  }

  clear() {
    if (this.set.size === 0) return;
    const old = [...this.set];
    this.set.clear();
    for (const p of old) {
      this.listeners.get(p)?.forEach((cb) => cb());
    }
    this.allListeners.forEach((cb) => cb());
  }

  replace(paths: Iterable<string>) {
    const next = new Set(paths);
    const all = new Set([...this.set, ...next]);
    this.set = next;
    for (const p of all) {
      this.listeners.get(p)?.forEach((cb) => cb());
    }
    this.allListeners.forEach((cb) => cb());
  }

  /** Subscribe vào 1 path — return unsubscribe */
  subscribePath(path: string, cb: () => void): () => void {
    let s = this.listeners.get(path);
    if (!s) {
      s = new Set();
      this.listeners.set(path, s);
    }
    s.add(cb);
    return () => {
      s?.delete(cb);
      if (s?.size === 0) this.listeners.delete(path);
    };
  }

  /** Subscribe mọi thay đổi (cho folder count, summary) */
  subscribeAll(cb: () => void): () => void {
    this.allListeners.add(cb);
    return () => this.allListeners.delete(cb);
  }
}

const SelectionContext = createContext<SelectionStore | null>(null);

/** Hook: subscribe checked status của 1 path — chỉ row đó re-render khi đổi */
function useIsSelected(path: string): boolean {
  const store = useContext(SelectionContext);
  if (!store) throw new Error('SelectionContext missing');
  return useSyncExternalStore(
    (cb) => store.subscribePath(path, cb),
    () => store.has(path),
  );
}

/** Hook: count selected trong descendants — chỉ folder render khi store đổi */
function useFolderCount(allDescendants: string[]): { checked: number; total: number } {
  const store = useContext(SelectionContext);
  if (!store) throw new Error('SelectionContext missing');
  const subscribe = useCallback(
    (cb: () => void) => store.subscribeAll(cb),
    [store],
  );
  const getSnapshot = useCallback(() => {
    let count = 0;
    for (const p of allDescendants) if (store.has(p)) count++;
    return count;
  }, [allDescendants, store]);
  const checked = useSyncExternalStore(subscribe, getSnapshot);
  return { checked, total: allDescendants.length };
}

/**
 * Restore selection từ paths cũ:
 *   - Cố overlap với paths mới → giữ overlap
 *   - Không overlap → select all (lần đầu hoặc folder khác hoàn toàn)
 */
function restoreSelection(currentPaths: string[], previousPaths: string[]): string[] {
  if (previousPaths.length === 0) return currentPaths;
  const prev = new Set(previousPaths);
  const intersect = currentPaths.filter((p) => prev.has(p));
  if (intersect.length === 0) return currentPaths;
  return intersect;
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

  // Selection store — không qua React state để tránh re-render toàn cây.
  // Persist qua localStorage: load 1 lần lúc mount, save khi store đổi.
  const selectionStore = useMemo(() => {
    let initial: string[] = [];
    try {
      const raw = localStorage.getItem(LS_SELECTED_PATHS);
      if (raw) initial = JSON.parse(raw);
    } catch { /* ignore */ }
    return new SelectionStore(Array.isArray(initial) ? initial : []);
  }, []);

  // Persist khi store đổi (debounce 200ms để không spam localStorage khi tick nhanh)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return selectionStore.subscribeAll(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(
            LS_SELECTED_PATHS,
            JSON.stringify(selectionStore.getAll()),
          );
        } catch { /* ignore */ }
      }, 200);
    });
  }, [selectionStore]);

  // Subscribe summary count cho footer
  const totalSelected = useSyncExternalStore(
    useCallback((cb) => selectionStore.subscribeAll(cb), [selectionStore]),
    useCallback(() => selectionStore.size(), [selectionStore]),
  );

  // Options persist sang localStorage
  const [options, setOptions] = useLocalStorage<PackOptions>(
    LS_OPTIONS,
    DEFAULT_OPTIONS,
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPacking, setIsPacking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; path: string } | null>(null);
  const [parts, setParts] = useState<PackPart[]>([]);
  // Loading indicator cho các thao tác nặng (scan, toggle, zip)
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  // Save-to-source state — persist qua các lần click để resume phần fail.
  // packId dùng chung giữa lần đầu + lần retry → không tạo dupe khi user click "Lưu tiếp".
  const [saveState, setSaveState] = useState<{
    isSaving: boolean;
    packId: string | null;
    savedIndices: number[]; // dùng array cho stable identity (Set g├óy re-render infinite)
    failedIndices: number[];
    saved: number;
    total: number;
  }>({ isSaving: false, packId: null, savedIndices: [], failedIndices: [], saved: 0, total: 0 });
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
    selectionStore.clear();
    setLogs([]);
    setParts([]);
    setIsPacking(false);
    setSaveState({ isSaving: false, packId: null, savedIndices: [], failedIndices: [], saved: 0, total: 0 });
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
      return; // KHÔNG vào finally để giữ busyMessage tß╗¢i khi reload
    } catch (e) {
      toast.error('Không tạo được ZIP');
      log(`Lß╗ùi tạo ZIP: ${String(e)}`, 'error');
      setBusyMessage(null);
    }
  }

  // Download mß╗ùi part thănh file .txt ri├¬ng (loop downloadBlob)
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
  // Lưu tất cả parts vào Source (mß╗ùi part = 1 source ri├¬ng)
  //
  // Idempotency:
  //  - packId + partIndex là identity duy nhất, tag lưu trong `tags` field.
  //  - Tr╞░ß╗¢c khi retry (attempt >= 1), verify với server: GET /notes → filter
  //    theo pack-id → parse part index từ tag "part:N/M" → mark nhß╗»ng part
  //    đã có trênn server là saved. Xß╗¡ lừ case AbortError-nh╞░ng-server-đã-tạo
  //    (timeout 45s vẫn có thể xß║úy ra với MockAPI free tier).
  //
  // Resume:
  //  - Khi user click lần 2 mà saveState c├▓n failedIndices → reuse packId cũ,
  //    chỉ POST index ch╞░a done. Không tạo pack mới.
  //  - Khi hoàn thănh 100% → set failedIndices=[] để lần click sau (nếu có
  //    parts mới) lß║íi là save mới.
  //
  // Timeout: 45s (MockAPI free tier P99 latency ~20-30s).
  // ============================================================
  async function handleSaveToSource(parts: PackPart[]) {
    if (parts.length === 0 || saveState.isSaving) return;

    const { fetchJson } = await import('@/api/client');
    const { API } = await import('@/lib/config');
    const now = new Date().toISOString();

    // Resume: nếu có packId + savedIndices từ lần trước cho cùng bộ parts
    //         (số l╞░ß╗úng part khß╗¢p) → chỉ save phần thiß║┐u.
    const isResume =
      saveState.packId !== null &&
      saveState.total === parts.length &&
      saveState.failedIndices.length > 0;

    const packId = isResume
      ? saveState.packId!
      : `pack_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const baseTitle = `Project Packed - ${new Date().toLocaleString('vi-VN')}`;

    let savedSet = new Set<number>(isResume ? saveState.savedIndices : []);
    let pendingIndices: number[] = isResume
      ? [...saveState.failedIndices]
      : parts.map((_, i) => i);

    setSaveState({
      isSaving: true,
      packId,
      savedIndices: [...savedSet],
      failedIndices: [],
      saved: savedSet.size,
      total: parts.length,
    });

    if (isResume) {
      log(`Resume lưu Source: c├▓n ${pendingIndices.length}/${parts.length} part`, 'info');
    } else {
      log(`Bß║»t đầu lưu ${parts.length} part vào Source...`);
    }

    const TIMEOUT_MS = 45_000;
    const MAX_RETRIES = 2;

    // Helper: verify với server nhß╗»ng index năo thß╗▒c sß╗▒ đã lưu (dedupe).
    async function verifyServer(): Promise<void> {
      try {
        const raw = await fetchJson<unknown[]>(API.NOTES);
        const foundIndices = new Set<number>();
        for (const item of Array.isArray(raw) ? raw : []) {
          const tags =
            item && typeof item === 'object' && 'tags' in item
              ? (item as { tags?: unknown }).tags
              : null;
          if (typeof tags !== 'string') continue;
          if (!tags.includes(`pack-id:${packId}`)) continue;
          const m = tags.match(/part:(\d+)\//);
          if (m) foundIndices.add(parseInt(m[1], 10) - 1);
        }
        // Merge vào savedSet
        let newlyFound = 0;
        for (const idx of foundIndices) {
          if (!savedSet.has(idx)) {
            savedSet.add(idx);
            newlyFound++;
          }
        }
        if (newlyFound > 0) {
          log(`Verify server: ${newlyFound} part thß╗▒c ra đã lưu (skip dupe)`, 'info');
        }
        pendingIndices = pendingIndices.filter((i) => !savedSet.has(i));
        setSaveState((s) => ({
          ...s,
          savedIndices: [...savedSet],
          saved: savedSet.size,
        }));
      } catch (e) {
        log(`Verify server fail: ${String(e)} — vẫn retry b├¼nh thưß╗¥ng`, 'warning');
      }
    }

    // Nß║┐u resume: verify trước để tận dụng thêm nhß╗»ng part đã lưu ngß║ºm
    // (case user F5 giữa chß╗½ng, hoặc pass đầu bß╗ï timeout nh╞░ng server nhận).
    if (isResume) {
      await verifyServer();
    }

    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (pendingIndices.length === 0) break;

        if (attempt > 0) {
          log(`Retry lần ${attempt}: ${pendingIndices.length} part ch╞░a lưu được...`, 'warning');
          // Verify trước retry: có thể part fail lần trước là AbortError nh╞░ng
          // server thß╗▒c sß╗▒ đã tạo → không cần POST lß║íi.
          await verifyServer();
          if (pendingIndices.length === 0) break;
          await new Promise((r) => setTimeout(r, 2000));
        }

        const stillFailed: number[] = [];

        for (const i of pendingIndices) {
          const part = parts[i];
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

            await fetchJson(API.NOTES, {
              method: 'POST',
              signal: controller.signal,
              body: JSON.stringify({
                type: 'source',
                title: parts.length === 1 ? baseTitle : `${baseTitle} (${i + 1}/${parts.length})`,
                content: part.content,
                tags: `packed, pack-id:${packId}, part:${i + 1}/${parts.length}, ${selectedFileCount} files`,
                source: 'project-packer',
                createdAt: now,
                updatedAt: now,
              }),
            });
            clearTimeout(timeout);
            savedSet.add(i);
            log(`Γ£ô Đã lưu part ${i + 1}/${parts.length}`, 'success');
            setSaveState((s) => ({
              ...s,
              savedIndices: [...savedSet],
              saved: savedSet.size,
            }));
          } catch (e) {
            stillFailed.push(i);
            if (attempt === MAX_RETRIES) {
              log(`Γ£ù Part ${i + 1} fail sau ${MAX_RETRIES + 1} lần: ${String(e)}`, 'error');
            }
          }

          // Delay 300ms giữa mß╗ùi request (MockAPI rate limit ~100 req/min)
          await new Promise((r) => setTimeout(r, 300));
        }

        pendingIndices = stillFailed;
      }

      // Verify lần cuß╗æi trước khi báo fail — bß║»t case last-attempt cũng abort
      // nh╞░ng server đã tạo.
      if (pendingIndices.length > 0) {
        await verifyServer();
      }

      const successCount = savedSet.size;
      const finalFailed = pendingIndices;

      setSaveState({
        isSaving: false,
        packId,
        savedIndices: [...savedSet],
        failedIndices: finalFailed,
        saved: successCount,
        total: parts.length,
      });

      if (successCount === parts.length) {
        log(`Γ£ô Hoăn tất! Đã lưu ${parts.length} part vào Source`, 'success');
        toast.success(`Đã lưu ${parts.length} part vào Source. Văo trang Sources để download.`);
      } else if (successCount > 0) {
        const missingParts = finalFailed.map((i) => i + 1).join(',');
        log(`ΓÜá Lưu ${successCount}/${parts.length} part. Thiß║┐u part: ${missingParts}`, 'warning');
        toast.warning(
          `Lưu ${successCount}/${parts.length} part. Click "Lưu tiếp ${finalFailed.length} part c├▓n thiß║┐u" để retry.`,
        );
      } else {
        log(`Γ£ù Không lưu được part năo`, 'error');
        toast.error('Không lưu được vào Source. Kiß╗âm tra kết nß╗æi mß║íng.');
      }
    } catch (e) {
      setSaveState((s) => ({
        ...s,
        isSaving: false,
        savedIndices: [...savedSet],
        failedIndices: pendingIndices,
        saved: savedSet.size,
      }));
      toast.error('Không lưu được vào Source');
      log(`Lß╗ùi save to source: ${String(e)}`, 'error');
    }
  }

  // ============================================================
  // Folder input — scan t├¬n, build tree, KH├öNG đọc content
  // ============================================================
  async function handleFolderInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) {
      setBusyMessage(null);
      return;
    }

    setBusyMessage(`Đang xß╗¡ lừ ${files.length.toLocaleString('vi-VN')} file...`);
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

    // Build tree (chỉ paths) — async, yield mß╗ùi 1000 paths
    const paths = filtered.map((f) => f.path);
    const newTree = await buildTree(paths);

    // Auto-select tất cả paths. Tách 2 setState bằng yield để React render mượt.
    setTree(newTree);
    await new Promise((r) => setTimeout(r, 0));
    // Restore selection từ localStorage nếu có overlap, không th├¼ select all
    const previousPaths = selectionStore.getAll();
    const restored = restoreSelection(paths, previousPaths);
    selectionStore.replace(restored);
    setParts([]);
    setLogs([{
      id: ++logIdRef.current,
      message:
        restored.length === paths.length
          ? `Đã qu├⌐t ${filtered.length} file (chß╗ìn tất cả)`
          : `Đã qu├⌐t ${filtered.length} file (restore ${restored.length}/${paths.length} file đã chß╗ìn trước)`,
      type: 'info',
      timestamp: new Date(),
    }]);
    setBusyMessage(null);
  }

  // ============================================================
  // Pack — đọc content files đã chß╗ìn
  // ============================================================
  async function handlePack() {
    setIsPacking(true);
    setParts([]);
    setLogs([]);
    setProgress({ current: 0, total: 0, path: '' });
    // Pack mới → clear save state cũ (packId cũ không c├▓n valid)
    setSaveState({ isSaving: false, packId: null, savedIndices: [], failedIndices: [], saved: 0, total: 0 });

    // Scroll tß╗¢i progress bar sau khi DOM render
    requestAnimationFrame(() => {
      progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Lß║Ñy file từ ref, lß╗ìc theo selection + filter.
    // Detect root prefix (nếu có): tất cả path cùng share segment đầu th├¼ đó là root.
    const sample = filesRef.current[0]?.path ?? '';
    const firstSegment = sample.split('/')[0];
    const hasRootPrefix =
      filesRef.current.length > 1 &&
      firstSegment.length > 0 &&
      filesRef.current.every((f) => f.path.startsWith(firstSegment + '/'));
    const stripRoot = (path: string): string =>
      hasRootPrefix ? path.split('/').slice(1).join('/') : path;

    // Log chi tiết file bß╗ï filter để user biß║┐t tại sao bß╗ï loß║íi.
    const filteredOut: { path: string; reason: string }[] = [];
    const toRead = filesRef.current.filter((f) => {
      if (!selectionStore.has(f.path)) return false;
      const relativePath = stripRoot(f.path);
      const filename = relativePath.split('/').pop() ?? '';

      // Whitelist file lß╗¢n (package-lock.json) — bypass exclude pattern.
      // Lừ do: user có thể có options cũ trong localStorage exclude file này.
      // Packer đã tự chunk được n├¬n không cần exclude nß╗»a.
      const isWhitelisted = LARGE_FILE_WHITELIST.has(filename);

      if (!isWhitelisted && isExcluded(relativePath, options.excludePatterns)) {
        filteredOut.push({ path: f.path, reason: 'exclude pattern' });
        return false;
      }
      if (!isExtensionAllowed(relativePath, options.includeExtensions)) {
        filteredOut.push({ path: f.path, reason: 'extension không trong include list' });
        return false;
      }
      return true;
    });

    // Log file bß╗ï filter (giß╗¢i hß║ín 30 d├▓ng để không spam)
    if (filteredOut.length > 0) {
      log(`Filter: ${filteredOut.length} file bß╗ï loß║íi (xem chi tiết b├¬n d╞░ß╗¢i)`, 'warning');
      for (const f of filteredOut.slice(0, 30)) {
        log(`  Γ£ù ${f.path} — ${f.reason}`, 'warning');
      }
      if (filteredOut.length > 30) {
        log(`  ... vă ${filteredOut.length - 30} file khác`, 'warning');
      }
    }

    setProgress({ current: 0, total: toRead.length, path: '' });
    log(`Bß║»t đầu đọc ${toRead.length} file...`);

    const { files: packedFiles, failed } = await readFiles(
      toRead.map((f) => ({ file: f.file, path: stripRoot(f.path) })),
      (p) => {
        setProgress({ current: p.current, total: p.total, path: p.currentPath });
        if (p.current % 50 === 0 || p.current === p.total) {
          log(`─Éß╗ìc ${p.current}/${p.total}: ${p.currentPath}`);
        }
      },
    );

    for (const f of failed.slice(0, 20)) {
      log(`Bß╗Å qua: ${f.path} (${f.reason})`, 'warning');
    }
    if (failed.length > 20) log(`... vă ${failed.length - 20} file khác bß╗ï bß╗Å qua`, 'warning');

    if (packedFiles.length === 0) {
      log('Không đọc được file năo!', 'error');
      setIsPacking(false);
      setProgress(null);
      return;
    }

    log(`Đã đọc ${packedFiles.length} file. Đang chia parts...`);
    setProgress({ current: packedFiles.length, total: packedFiles.length, path: 'Đang chia parts...' });
    const result = await packFiles(packedFiles, options);
    log(`Γ£ô Xong! ${result.length} part`, 'success');

    setParts(result);
    setIsPacking(false);
    setProgress(null);
  }

  // ─Éß║┐m file đã chß╗ìn (chỉ file, không folder paths)
  const selectedFileCount = useMemo(() => {
    if (!tree) return 0;
    let count = 0;
    const filePaths = new Set(filesRef.current.map((f) => f.path));
    const selected = selectionStore.getAll();
    for (const p of selected) {
      if (filePaths.has(p)) count++;
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, totalSelected]);

  return (
    <div className="space-y-3">
      {/* Loading overlay khi xß╗¡ lừ nặng */}
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
            // Hiển thị busy ngay v├¼ browser sß║╜ block UI khi scan folder lß╗¢n
            setBusyMessage('Đang mở dialog chß╗ìn folder...');
            const input = inputRef.current;
            if (!input) return;

            // Detect cancel/đóng dialog để clear busyMessage.
            // - `cancel` event: modern browser fire khi user đóng dialog không chß╗ìn
            //   (Chromium 113+, Firefox 91+). Không fire khi user chß╗ìn folder.
            // - `focus` fallback: dialog đóng → focus về window. Onchange của
            //   input sß║╜ fire TR╞»ß╗ÜC focus n├¬n check `files.length` để biß║┐t user
            //   thß╗▒c sß╗▒ chß╗ìn hay cancel.
            const clearIfNoFiles = () => {
              // Yield 1 tick để onChange (nếu có) chạy trước
              setTimeout(() => {
                if ((input.files?.length ?? 0) === 0) {
                  setBusyMessage((m) =>
                    m === 'Đang mở dialog chß╗ìn folder...' ? null : m,
                  );
                }
              }, 0);
              input.removeEventListener('cancel', clearIfNoFiles);
              window.removeEventListener('focus', clearIfNoFiles);
            };
            input.addEventListener('cancel', clearIfNoFiles);
            window.addEventListener('focus', clearIfNoFiles);

            input.click();
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
            setBusyMessage('Đang qu├⌐t thư mục...');
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
              const previousPaths = selectionStore.getAll();
              const restored = restoreSelection(paths, previousPaths);
              selectionStore.replace(restored);
              setParts([]);
              setLogs([{
                id: ++logIdRef.current,
                message:
                  restored.length === paths.length
                    ? `Đã qu├⌐t ${collected.length} file (drag-drop, chß╗ìn tất cả)`
                    : `Đã qu├⌐t ${collected.length} file (restore ${restored.length}/${paths.length})`,
                type: 'info',
                timestamp: new Date(),
              }]);
            }
            setBusyMessage(null);
          }}
          className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-border bg-card py-10 text-center transition-colors hover:border-primary hover:bg-popover"
        >
          <FolderOpen className="mb-2 h-8 w-8 text-primary" />
          <p className="text-sm font-medium text-foreground">K├⌐o-thß║ú thư mục vào đ├óy</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hoß║╖c click để chß╗ìn (k├⌐o-thß║ú nhanh h╞ín, không bß╗ï lag với project lß╗¢n)
          </p>
          <p className="mt-2 text-[10px] text-warning/80">
            Click chß╗ìn folder có thể lag nếu project lß╗¢n
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
                C├óy thư mục — {selectedFileCount}/{tree.fileCount} file đã chß╗ìn
              </span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setBusyMessage('Đang chß╗ìn tất cả...');
                    await new Promise((r) => setTimeout(r, 0));
                    const all: string[] = [];
                    function collect(node: TreeNode) {
                      all.push(node.path);
                      for (const c of node.children) collect(c);
                    }
                    for (const c of tree.children) collect(c);
                    selectionStore.replace(all);
                    setBusyMessage(null);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Chọn tất cả
                </button>
                <button
                  onClick={async () => {
                    setBusyMessage('Đang bß╗Å chß╗ìn...');
                    await new Promise((r) => setTimeout(r, 0));
                    selectionStore.clear();
                    setBusyMessage(null);
                  }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Bß╗Å chß╗ìn
                </button>
              </div>
            </div>

            <SelectionContext.Provider value={selectionStore}>
              <div className="max-h-80 overflow-y-auto p-1 text-xs">
                {tree.children.map((node) => (
                  <TreeNodeView
                    key={node.path}
                    node={node}
                    depth={0}
                    onToggle={(paths, checked) => selectionStore.toggle(paths, checked)}
                  />
                ))}
              </div>
            </SelectionContext.Provider>
          </div>

          <div className="flex items-center justify-between border border-border bg-card px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {selectedFileCount} file sß║╜ được pack
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
                  {progress.total > 0 ? `${progress.current}/${progress.total} file` : 'Đang chuẩn bß╗ï...'}
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
                  Output: <span className="font-semibold">{parts.length}</span> part ┬╖{' '}
                  Tổng <span className="font-semibold">
                    {parts.reduce((s, p) => s + p.charCount, 0).toLocaleString('vi-VN')}
                  </span> ký tự
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSaveToSource(parts)}
                    disabled={saveState.isSaving}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    {saveState.isSaving ? (
                      <PackerLoadingSpinner size="sm" />
                    ) : (
                      <Package className="h-3 w-3" />
                    )}
                    {saveState.isSaving
                      ? `Đang lưu ${saveState.saved}/${saveState.total}...`
                      : saveState.failedIndices.length > 0
                        ? `Lưu tiếp ${saveState.failedIndices.length} part c├▓n thiß║┐u`
                        : saveState.saved === parts.length && saveState.saved > 0
                          ? `Đã lưu ${saveState.saved}/${parts.length}`
                          : 'Lưu vào Source'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleDownloadAllAsZip(parts)}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    <Archive className="h-3 w-3" />
                    Tß║úi ZIP ({parts.length} parts)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadAllAsTxt(parts)}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    <Download className="h-3 w-3" />
                    Tß║úi .txt ri├¬ng
                  </Button>
                </div>
              </div>

              {/* Save-to-Source progress bar — hiß╗çn khi đang lưu hoặc save dở */}
              {(saveState.isSaving || saveState.saved > 0 || saveState.failedIndices.length > 0) && (
                <div className="border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {saveState.isSaving
                        ? `Đang lưu vào Source: ${saveState.saved}/${saveState.total} part`
                        : saveState.failedIndices.length === 0
                          ? `Đã lưu xong ${saveState.saved}/${saveState.total} part`
                          : `Đã lưu ${saveState.saved}/${saveState.total} — thiß║┐u part ${saveState.failedIndices.map((i) => i + 1).join(', ')}`}
                    </span>
                    <span className="font-mono text-primary">
                      {saveState.total > 0
                        ? `${Math.round((saveState.saved / saveState.total) * 100)}%`
                        : ''}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden bg-background">
                    <div
                      className={cn(
                        'h-full transition-all',
                        saveState.failedIndices.length > 0 && !saveState.isSaving
                          ? 'bg-warning'
                          : 'bg-primary',
                      )}
                      style={{
                        width:
                          saveState.total > 0
                            ? `${(saveState.saved / saveState.total) * 100}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>
              )}

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
// TreeNodeView - render 1 node, lazy children (collapsed mß║╖c định nếu > 50 children)
// ============================================================
function TreeNodeView({
  node,
  depth,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  onToggle: (paths: string[], checked: boolean) => void;
}) {
  // Folder lß╗¢n (>30 children) collapsed mß║╖c định
  const [collapsed, setCollapsed] = useState(node.children.length > 30);

  if (!node.isFolder) {
    return <FileRow node={node} depth={depth} onToggle={onToggle} />;
  }

  return (
    <FolderRow
      node={node}
      depth={depth}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((v) => !v)}
      onToggle={onToggle}
    />
  );
}

/** File row — subscribe path mình → chỉ re-render khi tick state đổi */
function FileRow({
  node,
  depth,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  onToggle: (paths: string[], checked: boolean) => void;
}) {
  const checked = useIsSelected(node.path);
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-1.5 py-1 transition-colors hover:bg-popover',
        !checked && 'opacity-50',
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onToggle([node.path], !!c)}
        className="h-4 w-4 cursor-pointer"
      />
      <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground">{node.name}</span>
    </label>
  );
}

/** Folder row — subscribe all để re-count khi descendants đổi */
function FolderRow({
  node,
  depth,
  collapsed,
  onToggleCollapse,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggle: (paths: string[], checked: boolean) => void;
}) {
  const allDescendants = node.descendantPaths;
  const { checked: checkedCount, total } = useFolderCount(allDescendants);
  const isAllChecked = checkedCount === total;
  const isPartial = checkedCount > 0 && !isAllChecked;

  return (
    <div>
      <div
        onClick={onToggleCollapse}
        className="flex cursor-pointer items-center gap-1 py-1 transition-colors hover:bg-popover"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <Checkbox
          checked={isAllChecked}
          ref={(el) => {
            if (el) {
              const input = el as HTMLButtonElement & { indeterminate?: boolean };
              input.indeterminate = isPartial;
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(c) => onToggle(allDescendants, !!c)}
          className="h-4 w-4 cursor-pointer"
        />
        <label
          onClick={(e) => {
            e.stopPropagation();
            onToggle(allDescendants, !isAllChecked);
          }}
          className="flex cursor-pointer items-center gap-1"
        >
          <FolderOpen className="h-3 w-3 text-primary" />
          <span className="font-medium text-foreground">{node.name}/</span>
          <span className="text-muted-foreground">({node.fileCount})</span>
        </label>
      </div>

      {!collapsed && (
        <div>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.path}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
