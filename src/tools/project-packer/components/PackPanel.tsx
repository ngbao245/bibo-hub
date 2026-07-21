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
// PackPanel - hiß╗ân thß╗ï c├óy th╞░ mß╗Ñc, kh├┤ng crash
// ============================================================
//
// Tr├ính crash bß║▒ng c├ích:
// 1. File[] l╞░u trong useRef (KH├öNG v├áo React state) ΓåÆ kh├┤ng trigger re-render khß╗òng lß╗ô
// 2. Tree state chß╗ë chß╗⌐a metadata (path, type) ΓåÆ nhß║╣
// 3. Lazy render: folder collapsed ΓåÆ kh├┤ng render children
//
// Persist (cß╗⌐u khi crash):
// - Options: localStorage 'packer.options'
// - Selection paths: localStorage 'packer.selectedPaths'
//   ΓåÆ user mß╗ƒ folder lß║íi, app tß╗▒ restore tick tß╗½ paths c┼⌐.
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
// Drag-drop traverse ΓÇö skip HIDDEN_FOLDERS NGAY tß║íi folder entry
// (tß║¡n dß╗Ñng webkitGetAsEntry ΓÇö KH├öNG scan node_modules)
// ============================================================
async function traverseEntry(
  entry: FileSystemEntry,
  parentPath: string,
  out: { file: File; path: string }[],
): Promise<void> {
  // Skip ngay nß║┐u folder name nß║▒m trong blacklist ΓåÆ kh├┤ng v├áo!
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
    // readEntries chß╗ë trß║ú max 100 entries 1 lß║ºn, phß║úi loop
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
  path: string;          // full path tß╗½ root
  isFolder: boolean;
  children: TreeNode[];  // chß╗ë folder mß╗¢i c├│ children
  fileCount: number;     // tß╗òng sß╗æ file con (folder), 1 (file)
  descendantPaths: string[]; // cache: tß║Ñt cß║ú path con (cho toggle nhanh)
}

/**
 * Selection store ΓÇö Set<string> + per-path subscriptions.
 *
 * L├╜ do KH├öNG d├╣ng React state cho selectedPaths:
 *   - Mß╗ùi tick ΓåÆ setState ΓåÆ re-render TO├ÇN Bß╗ÿ tree (5000 row).
 *   - Mß╗ùi folder phß║úi re-compute count = O(descendants) ├ù O(folders) = O(n┬▓).
 *
 * C├ích d├╣ng: row subscribe v├áo path cß╗ºa m├¼nh, chß╗ë row ─æ├│ re-render.
 * Folder count vß║½n l├á O(descendants) NH╞»NG chß╗ë chß║íy khi count ─æß╗òi
 * (kh├┤ng phß║úi mß╗ùi setState).
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

  /** Snapshot to├án bß╗Ö ΓÇö d├╣ng ─æß╗â persist localStorage hoß║╖c count. */
  getAll(): string[] {
    return [...this.set];
  }

  size(): number {
    return this.set.size;
  }

  /** Toggle nhiß╗üu path 1 lß║ºn, fire chß╗ë nhß╗»ng path ─æß╗òi. */
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

  /** Subscribe v├áo 1 path ΓÇö return unsubscribe */
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

  /** Subscribe mß╗ìi thay ─æß╗òi (cho folder count, summary) */
  subscribeAll(cb: () => void): () => void {
    this.allListeners.add(cb);
    return () => this.allListeners.delete(cb);
  }
}

const SelectionContext = createContext<SelectionStore | null>(null);

/** Hook: subscribe checked status cß╗ºa 1 path ΓÇö chß╗ë row ─æ├│ re-render khi ─æß╗òi */
function useIsSelected(path: string): boolean {
  const store = useContext(SelectionContext);
  if (!store) throw new Error('SelectionContext missing');
  return useSyncExternalStore(
    (cb) => store.subscribePath(path, cb),
    () => store.has(path),
  );
}

/** Hook: count selected trong descendants ΓÇö chß╗ë folder render khi store ─æß╗òi */
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
 * Restore selection tß╗½ paths c┼⌐:
 *   - C├│ overlap vß╗¢i paths mß╗¢i ΓåÆ giß╗» overlap
 *   - Kh├┤ng overlap ΓåÆ select all (lß║ºn ─æß║ºu hoß║╖c folder kh├íc ho├án to├án)
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
    // Yield mß╗ùi 1000 paths ─æß╗â main thread kh├┤ng block
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

  // T├¡nh fileCount + descendantPaths ─æß╗ç quy + sort folder tr╞░ß╗¢c file
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
    // Sort: folder tr╞░ß╗¢c, sau ─æ├│ alphabet
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
  // File objects giß╗» trong ref ΓÇö KH├öNG v├áo state
  const filesRef = useRef<{ file: File; path: string }[]>([]);

  // State chß╗ë chß╗⌐a data nhß║╣
  const [tree, setTree] = useState<TreeNode | null>(null);

  // Selection store ΓÇö kh├┤ng qua React state ─æß╗â tr├ính re-render to├án c├óy.
  // Persist qua localStorage: load 1 lß║ºn l├║c mount, save khi store ─æß╗òi.
  const selectionStore = useMemo(() => {
    let initial: string[] = [];
    try {
      const raw = localStorage.getItem(LS_SELECTED_PATHS);
      if (raw) initial = JSON.parse(raw);
    } catch { /* ignore */ }
    return new SelectionStore(Array.isArray(initial) ? initial : []);
  }, []);

  // Persist khi store ─æß╗òi (debounce 200ms ─æß╗â kh├┤ng spam localStorage khi tick nhanh)
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
  // Loading indicator cho c├íc thao t├íc nß║╖ng (scan, toggle, zip)
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  // Save-to-source state ΓÇö persist qua c├íc lß║ºn click ─æß╗â resume phß║ºn fail.
  // packId d├╣ng chung giß╗»a lß║ºn ─æß║ºu + lß║ºn retry ΓåÆ kh├┤ng tß║ío dupe khi user click "L╞░u tiß║┐p".
  const [saveState, setSaveState] = useState<{
    isSaving: boolean;
    packId: string | null;
    savedIndices: number[]; // d├╣ng array cho stable identity (Set g├óy re-render infinite)
    failedIndices: number[];
    saved: number;
    total: number;
  }>({ isSaving: false, packId: null, savedIndices: [], failedIndices: [], saved: 0, total: 0 });
  const logIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Progress hiß╗ân thß╗ï (smooth animated). Kh├íc vß╗¢i `progress.current` l├á raw value.
  const [displayProgress, setDisplayProgress] = useState(0);

  // Tween displayProgress vß╗ü `progress.current` mß╗ùi animation frame
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
        // Ease: di chuyß╗ân 8% khoß║úng c├ích mß╗ùi frame ΓåÆ m╞░ß╗út + ─æuß╗òi kß╗ïp
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
  // Download all parts as 1 ZIP (chß╗⌐a nhiß╗üu .txt files)
  // ============================================================
  async function handleDownloadAllAsZip(parts: PackPart[]) {
    if (parts.length === 0) return;
    setBusyMessage(`─Éang tß║ío ZIP vß╗¢i ${parts.length} part...`);
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
        compressionOptions: { level: 3 }, // level thß║Ñp = n├⌐n nhanh, ├¡t block CPU
      });

      downloadBlob(blob, 'project-packed.zip');
      toast.success(`─É├ú tß║úi ZIP (${(blob.size / 1024).toFixed(1)} KB)`);
      // Hiß╗ân thß╗ï th├┤ng b├ío reload, sau 1.5s reload page
      setBusyMessage('─É├ú tß║úi xong. ─Éang reload ─æß╗â clear cache...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      return; // KH├öNG v├áo finally ─æß╗â giß╗» busyMessage tß╗¢i khi reload
    } catch (e) {
      toast.error('Kh├┤ng tß║ío ─æ╞░ß╗úc ZIP');
      log(`Lß╗ùi tß║ío ZIP: ${String(e)}`, 'error');
      setBusyMessage(null);
    }
  }

  // Download mß╗ùi part th├ánh file .txt ri├¬ng (loop downloadBlob)
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
    toast.success(`─É├ú tß║úi ${parts.length} file .txt`);
    setBusyMessage('─É├ú tß║úi xong. ─Éang reload ─æß╗â clear cache...');
    setTimeout(() => window.location.reload(), 1500);
  }

  // ============================================================
  // L╞░u tß║Ñt cß║ú parts v├áo Source (mß╗ùi part = 1 source ri├¬ng)
  //
  // Idempotency:
  //  - packId + partIndex l├á identity duy nhß║Ñt, tag l╞░u trong `tags` field.
  //  - Tr╞░ß╗¢c khi retry (attempt >= 1), verify vß╗¢i server: GET /notes ΓåÆ filter
  //    theo pack-id ΓåÆ parse part index tß╗½ tag "part:N/M" ΓåÆ mark nhß╗»ng part
  //    ─æ├ú c├│ tr├¬n server l├á saved. Xß╗¡ l├╜ case AbortError-nh╞░ng-server-─æ├ú-tß║ío
  //    (timeout 45s vß║½n c├│ thß╗â xß║úy ra vß╗¢i MockAPI free tier).
  //
  // Resume:
  //  - Khi user click lß║ºn 2 m├á saveState c├▓n failedIndices ΓåÆ reuse packId c┼⌐,
  //    chß╗ë POST index ch╞░a done. Kh├┤ng tß║ío pack mß╗¢i.
  //  - Khi ho├án th├ánh 100% ΓåÆ set failedIndices=[] ─æß╗â lß║ºn click sau (nß║┐u c├│
  //    parts mß╗¢i) lß║íi l├á save mß╗¢i.
  //
  // Timeout: 45s (MockAPI free tier P99 latency ~20-30s).
  // ============================================================
  async function handleSaveToSource(parts: PackPart[]) {
    if (parts.length === 0 || saveState.isSaving) return;

    const { fetchJson } = await import('@/api/client');
    const { API } = await import('@/lib/config');
    const now = new Date().toISOString();

    // Resume: nß║┐u c├│ packId + savedIndices tß╗½ lß║ºn tr╞░ß╗¢c cho c├╣ng bß╗Ö parts
    //         (sß╗æ l╞░ß╗úng part khß╗¢p) ΓåÆ chß╗ë save phß║ºn thiß║┐u.
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
      log(`Resume l╞░u Source: c├▓n ${pendingIndices.length}/${parts.length} part`, 'info');
    } else {
      log(`Bß║»t ─æß║ºu l╞░u ${parts.length} part v├áo Source...`);
    }

    const TIMEOUT_MS = 45_000;
    const MAX_RETRIES = 2;

    // Helper: verify vß╗¢i server nhß╗»ng index n├áo thß╗▒c sß╗▒ ─æ├ú l╞░u (dedupe).
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
        // Merge v├áo savedSet
        let newlyFound = 0;
        for (const idx of foundIndices) {
          if (!savedSet.has(idx)) {
            savedSet.add(idx);
            newlyFound++;
          }
        }
        if (newlyFound > 0) {
          log(`Verify server: ${newlyFound} part thß╗▒c ra ─æ├ú l╞░u (skip dupe)`, 'info');
        }
        pendingIndices = pendingIndices.filter((i) => !savedSet.has(i));
        setSaveState((s) => ({
          ...s,
          savedIndices: [...savedSet],
          saved: savedSet.size,
        }));
      } catch (e) {
        log(`Verify server fail: ${String(e)} ΓÇö vß║½n retry b├¼nh th╞░ß╗¥ng`, 'warning');
      }
    }

    // Nß║┐u resume: verify tr╞░ß╗¢c ─æß╗â tß║¡n dß╗Ñng th├¬m nhß╗»ng part ─æ├ú l╞░u ngß║ºm
    // (case user F5 giß╗»a chß╗½ng, hoß║╖c pass ─æß║ºu bß╗ï timeout nh╞░ng server nhß║¡n).
    if (isResume) {
      await verifyServer();
    }

    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (pendingIndices.length === 0) break;

        if (attempt > 0) {
          log(`Retry lß║ºn ${attempt}: ${pendingIndices.length} part ch╞░a l╞░u ─æ╞░ß╗úc...`, 'warning');
          // Verify tr╞░ß╗¢c retry: c├│ thß╗â part fail lß║ºn tr╞░ß╗¢c l├á AbortError nh╞░ng
          // server thß╗▒c sß╗▒ ─æ├ú tß║ío ΓåÆ kh├┤ng cß║ºn POST lß║íi.
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
            log(`Γ£ô ─É├ú l╞░u part ${i + 1}/${parts.length}`, 'success');
            setSaveState((s) => ({
              ...s,
              savedIndices: [...savedSet],
              saved: savedSet.size,
            }));
          } catch (e) {
            stillFailed.push(i);
            if (attempt === MAX_RETRIES) {
              log(`Γ£ù Part ${i + 1} fail sau ${MAX_RETRIES + 1} lß║ºn: ${String(e)}`, 'error');
            }
          }

          // Delay 300ms giß╗»a mß╗ùi request (MockAPI rate limit ~100 req/min)
          await new Promise((r) => setTimeout(r, 300));
        }

        pendingIndices = stillFailed;
      }

      // Verify lß║ºn cuß╗æi tr╞░ß╗¢c khi b├ío fail ΓÇö bß║»t case last-attempt c┼⌐ng abort
      // nh╞░ng server ─æ├ú tß║ío.
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
        log(`Γ£ô Ho├án tß║Ñt! ─É├ú l╞░u ${parts.length} part v├áo Source`, 'success');
        toast.success(`─É├ú l╞░u ${parts.length} part v├áo Source. V├áo trang Sources ─æß╗â download.`);
      } else if (successCount > 0) {
        const missingParts = finalFailed.map((i) => i + 1).join(',');
        log(`ΓÜá L╞░u ${successCount}/${parts.length} part. Thiß║┐u part: ${missingParts}`, 'warning');
        toast.warning(
          `L╞░u ${successCount}/${parts.length} part. Click "L╞░u tiß║┐p ${finalFailed.length} part c├▓n thiß║┐u" ─æß╗â retry.`,
        );
      } else {
        log(`Γ£ù Kh├┤ng l╞░u ─æ╞░ß╗úc part n├áo`, 'error');
        toast.error('Kh├┤ng l╞░u ─æ╞░ß╗úc v├áo Source. Kiß╗âm tra kß║┐t nß╗æi mß║íng.');
      }
    } catch (e) {
      setSaveState((s) => ({
        ...s,
        isSaving: false,
        savedIndices: [...savedSet],
        failedIndices: pendingIndices,
        saved: savedSet.size,
      }));
      toast.error('Kh├┤ng l╞░u ─æ╞░ß╗úc v├áo Source');
      log(`Lß╗ùi save to source: ${String(e)}`, 'error');
    }
  }

  // ============================================================
  // Folder input ΓÇö scan t├¬n, build tree, KH├öNG ─æß╗ìc content
  // ============================================================
  async function handleFolderInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) {
      setBusyMessage(null);
      return;
    }

    setBusyMessage(`─Éang xß╗¡ l├╜ ${files.length.toLocaleString('vi-VN')} file...`);
    // Yield ─æß╗â UI render busy message tr╞░ß╗¢c khi block
    await new Promise((r) => setTimeout(r, 0));

    // Filter hidden folders
    const filtered = files
      .map((f) => ({ file: f, path: f.webkitRelativePath || f.name }))
      .filter(({ path }) => {
        const parts = path.split('/');
        return !parts.some((p) => HIDDEN_FOLDERS.has(p));
      });

    // L╞░u File[] v├áo ref (KH├öNG v├áo state)
    filesRef.current = filtered;

    // Build tree (chß╗ë paths) ΓÇö async, yield mß╗ùi 1000 paths
    const paths = filtered.map((f) => f.path);
    const newTree = await buildTree(paths);

    // Auto-select tß║Ñt cß║ú paths. T├ích 2 setState bß║▒ng yield ─æß╗â React render m╞░ß╗út.
    setTree(newTree);
    await new Promise((r) => setTimeout(r, 0));
    // Restore selection tß╗½ localStorage nß║┐u c├│ overlap, kh├┤ng th├¼ select all
    const previousPaths = selectionStore.getAll();
    const restored = restoreSelection(paths, previousPaths);
    selectionStore.replace(restored);
    setParts([]);
    setLogs([{
      id: ++logIdRef.current,
      message:
        restored.length === paths.length
          ? `─É├ú qu├⌐t ${filtered.length} file (chß╗ìn tß║Ñt cß║ú)`
          : `─É├ú qu├⌐t ${filtered.length} file (restore ${restored.length}/${paths.length} file ─æ├ú chß╗ìn tr╞░ß╗¢c)`,
      type: 'info',
      timestamp: new Date(),
    }]);
    setBusyMessage(null);
  }

  // ============================================================
  // Pack ΓÇö ─æß╗ìc content files ─æ├ú chß╗ìn
  // ============================================================
  async function handlePack() {
    setIsPacking(true);
    setParts([]);
    setLogs([]);
    setProgress({ current: 0, total: 0, path: '' });
    // Pack mß╗¢i ΓåÆ clear save state c┼⌐ (packId c┼⌐ kh├┤ng c├▓n valid)
    setSaveState({ isSaving: false, packId: null, savedIndices: [], failedIndices: [], saved: 0, total: 0 });

    // Scroll tß╗¢i progress bar sau khi DOM render
    requestAnimationFrame(() => {
      progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Lß║Ñy file tß╗½ ref, lß╗ìc theo selection + filter.
    // Detect root prefix (nß║┐u c├│): tß║Ñt cß║ú path c├╣ng share segment ─æß║ºu th├¼ ─æ├│ l├á root.
    const sample = filesRef.current[0]?.path ?? '';
    const firstSegment = sample.split('/')[0];
    const hasRootPrefix =
      filesRef.current.length > 1 &&
      firstSegment.length > 0 &&
      filesRef.current.every((f) => f.path.startsWith(firstSegment + '/'));
    const stripRoot = (path: string): string =>
      hasRootPrefix ? path.split('/').slice(1).join('/') : path;

    // Log chi tiß║┐t file bß╗ï filter ─æß╗â user biß║┐t tß║íi sao bß╗ï loß║íi.
    const filteredOut: { path: string; reason: string }[] = [];
    const toRead = filesRef.current.filter((f) => {
      if (!selectionStore.has(f.path)) return false;
      const relativePath = stripRoot(f.path);
      const filename = relativePath.split('/').pop() ?? '';

      // Whitelist file lß╗¢n (package-lock.json) ΓÇö bypass exclude pattern.
      // L├╜ do: user c├│ thß╗â c├│ options c┼⌐ trong localStorage exclude file n├áy.
      // Packer ─æ├ú tß╗▒ chunk ─æ╞░ß╗úc n├¬n kh├┤ng cß║ºn exclude nß╗»a.
      const isWhitelisted = LARGE_FILE_WHITELIST.has(filename);

      if (!isWhitelisted && isExcluded(relativePath, options.excludePatterns)) {
        filteredOut.push({ path: f.path, reason: 'exclude pattern' });
        return false;
      }
      if (!isExtensionAllowed(relativePath, options.includeExtensions)) {
        filteredOut.push({ path: f.path, reason: 'extension kh├┤ng trong include list' });
        return false;
      }
      return true;
    });

    // Log file bß╗ï filter (giß╗¢i hß║ín 30 d├▓ng ─æß╗â kh├┤ng spam)
    if (filteredOut.length > 0) {
      log(`Filter: ${filteredOut.length} file bß╗ï loß║íi (xem chi tiß║┐t b├¬n d╞░ß╗¢i)`, 'warning');
      for (const f of filteredOut.slice(0, 30)) {
        log(`  Γ£ù ${f.path} ΓÇö ${f.reason}`, 'warning');
      }
      if (filteredOut.length > 30) {
        log(`  ... v├á ${filteredOut.length - 30} file kh├íc`, 'warning');
      }
    }

    setProgress({ current: 0, total: toRead.length, path: '' });
    log(`Bß║»t ─æß║ºu ─æß╗ìc ${toRead.length} file...`);

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
    if (failed.length > 20) log(`... v├á ${failed.length - 20} file kh├íc bß╗ï bß╗Å qua`, 'warning');

    if (packedFiles.length === 0) {
      log('Kh├┤ng ─æß╗ìc ─æ╞░ß╗úc file n├áo!', 'error');
      setIsPacking(false);
      setProgress(null);
      return;
    }

    log(`─É├ú ─æß╗ìc ${packedFiles.length} file. ─Éang chia parts...`);
    setProgress({ current: packedFiles.length, total: packedFiles.length, path: '─Éang chia parts...' });
    const result = await packFiles(packedFiles, options);
    log(`Γ£ô Xong! ${result.length} part`, 'success');

    setParts(result);
    setIsPacking(false);
    setProgress(null);
  }

  // ─Éß║┐m file ─æ├ú chß╗ìn (chß╗ë file, kh├┤ng folder paths)
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
      {/* Loading overlay khi xß╗¡ l├╜ nß║╖ng */}
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
            // Hiß╗ân thß╗ï busy ngay v├¼ browser sß║╜ block UI khi scan folder lß╗¢n
            setBusyMessage('─Éang mß╗ƒ dialog chß╗ìn folder...');
            const input = inputRef.current;
            if (!input) return;

            // Detect cancel/─æ├│ng dialog ─æß╗â clear busyMessage.
            // - `cancel` event: modern browser fire khi user ─æ├│ng dialog kh├┤ng chß╗ìn
            //   (Chromium 113+, Firefox 91+). Kh├┤ng fire khi user chß╗ìn folder.
            // - `focus` fallback: dialog ─æ├│ng ΓåÆ focus vß╗ü window. Onchange cß╗ºa
            //   input sß║╜ fire TR╞»ß╗ÜC focus n├¬n check `files.length` ─æß╗â biß║┐t user
            //   thß╗▒c sß╗▒ chß╗ìn hay cancel.
            const clearIfNoFiles = () => {
              // Yield 1 tick ─æß╗â onChange (nß║┐u c├│) chß║íy tr╞░ß╗¢c
              setTimeout(() => {
                if ((input.files?.length ?? 0) === 0) {
                  setBusyMessage((m) =>
                    m === '─Éang mß╗ƒ dialog chß╗ìn folder...' ? null : m,
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
            setBusyMessage('─Éang qu├⌐t th╞░ mß╗Ñc...');
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
                    ? `─É├ú qu├⌐t ${collected.length} file (drag-drop, chß╗ìn tß║Ñt cß║ú)`
                    : `─É├ú qu├⌐t ${collected.length} file (restore ${restored.length}/${paths.length})`,
                type: 'info',
                timestamp: new Date(),
              }]);
            }
            setBusyMessage(null);
          }}
          className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-border bg-card py-10 text-center transition-colors hover:border-primary hover:bg-popover"
        >
          <FolderOpen className="mb-2 h-8 w-8 text-primary" />
          <p className="text-sm font-medium text-foreground">K├⌐o-thß║ú th╞░ mß╗Ñc v├áo ─æ├óy</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hoß║╖c click ─æß╗â chß╗ìn (k├⌐o-thß║ú nhanh h╞ín, kh├┤ng bß╗ï lag vß╗¢i project lß╗¢n)
          </p>
          <p className="mt-2 text-[10px] text-warning/80">
            Click chß╗ìn folder c├│ thß╗â lag nß║┐u project lß╗¢n
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
                C├óy th╞░ mß╗Ñc ΓÇö {selectedFileCount}/{tree.fileCount} file ─æ├ú chß╗ìn
              </span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setBusyMessage('─Éang chß╗ìn tß║Ñt cß║ú...');
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
                  Chß╗ìn tß║Ñt cß║ú
                </button>
                <button
                  onClick={async () => {
                    setBusyMessage('─Éang bß╗Å chß╗ìn...');
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
              {selectedFileCount} file sß║╜ ─æ╞░ß╗úc pack
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
                {isPacking ? '─Éang pack...' : 'Pack'}
              </Button>
            </div>
          </div>

          <TerminalLog logs={logs} />

          {/* Progress bar khi ─æang pack */}
          {isPacking && progress && (
            <div ref={progressRef} className="border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  {progress.total > 0 ? `${progress.current}/${progress.total} file` : '─Éang chuß║⌐n bß╗ï...'}
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
                  ΓåÆ {progress.path}
                </p>
              )}
            </div>
          )}

          {parts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-border bg-card px-3 py-2 text-xs">
                <span>
                  Output: <span className="font-semibold">{parts.length}</span> part ┬╖{' '}
                  Tß╗òng <span className="font-semibold">
                    {parts.reduce((s, p) => s + p.charCount, 0).toLocaleString('vi-VN')}
                  </span> k├╜ tß╗▒
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
                      ? `─Éang l╞░u ${saveState.saved}/${saveState.total}...`
                      : saveState.failedIndices.length > 0
                        ? `L╞░u tiß║┐p ${saveState.failedIndices.length} part c├▓n thiß║┐u`
                        : saveState.saved === parts.length && saveState.saved > 0
                          ? `─É├ú l╞░u ${saveState.saved}/${parts.length}`
                          : 'L╞░u v├áo Source'}
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

              {/* Save-to-Source progress bar ΓÇö hiß╗çn khi ─æang l╞░u hoß║╖c save dß╗ƒ */}
              {(saveState.isSaving || saveState.saved > 0 || saveState.failedIndices.length > 0) && (
                <div className="border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {saveState.isSaving
                        ? `─Éang l╞░u v├áo Source: ${saveState.saved}/${saveState.total} part`
                        : saveState.failedIndices.length === 0
                          ? `─É├ú l╞░u xong ${saveState.saved}/${saveState.total} part`
                          : `─É├ú l╞░u ${saveState.saved}/${saveState.total} ΓÇö thiß║┐u part ${saveState.failedIndices.map((i) => i + 1).join(', ')}`}
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
// TreeNodeView - render 1 node, lazy children (collapsed mß║╖c ─æß╗ïnh nß║┐u > 50 children)
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
  // Folder lß╗¢n (>30 children) collapsed mß║╖c ─æß╗ïnh
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

/** File row ΓÇö subscribe path m├¼nh ΓåÆ chß╗ë re-render khi tick state ─æß╗òi */
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

/** Folder row ΓÇö subscribe all ─æß╗â re-count khi descendants ─æß╗òi */
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