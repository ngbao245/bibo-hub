import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Focus,
  Maximize,
  Minus,
  Plus,
  ImageUp,
  Search,
  ArrowLeftRight,
  CopyMinus,
  CopyPlus,
} from 'lucide-react';
import styles from './GraphToolbar.module.css';
import type { GraphViewRef } from './GraphView';
import { PreferencesMenu } from './PreferencesMenu';
import { DownloadImageDialog } from './DownloadImageDialog';
import { useJsonViewerStore } from '@/stores/jsonViewerStore';
import type { LayoutDirection } from '@/lib/json-viewer/types';
import { cn } from '@/lib/cn';

// ============================================================
// GraphToolbar - bottom-center overlay toolbar cho GraphView
// Tham khảo layout JSON Crack online editor:
//   Root | Fit | Zoom- | Zoom+ | Export PNG | Search | Rotate direction |
//   Collapse / Expand all
// ============================================================

interface GraphToolbarProps {
  graphRef: RefObject<GraphViewRef>;
  direction: LayoutDirection;
  onRotateDirection: () => void;
  collapsedCount: number;
}

const DIRECTION_LABEL: Record<LayoutDirection, string> = {
  RIGHT: 'Ngang →',
  DOWN: 'Dọc ↓',
  LEFT: 'Ngang ←',
  UP: 'Dọc ↑',
};

export function GraphToolbar({
  graphRef,
  direction,
  onRotateDirection,
  collapsedCount,
}: GraphToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState(0);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sourceFilename = useJsonViewerStore((s) => s.sourceFilename);

  // Tách tên file (bỏ extension) làm default cho filename input modal.
  const defaultExportName = sourceFilename.replace(/\.[^.]+$/, '') || 'graph';

  // Re-apply search highlight mỗi khi query thay đổi
  useEffect(() => {
    const api = graphRef.current;
    if (!api) return;
    const n = api.search(query);
    setMatches(n);
  }, [query, graphRef]);

  // Auto focus khi mở search
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      graphRef.current?.focusSearchMatch();
    } else if (e.key === 'Escape') {
      setQuery('');
      setSearchOpen(false);
      graphRef.current?.search('');
    }
  };

  const handleCollapseToggle = () => {
    if (collapsedCount > 0) {
      graphRef.current?.expandAll();
    } else {
      graphRef.current?.collapseAll();
    }
  };

  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => graphRef.current?.focusFirstNode()}
        title="Center first node"
      >
        <Focus className={styles.icon} />
      </button>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => graphRef.current?.centerView()}
        title="Fit to center"
      >
        <Maximize className={styles.icon} />
      </button>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => graphRef.current?.zoomOut()}
        title="Zoom out"
      >
        <Minus className={styles.iconSm} />
      </button>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => graphRef.current?.zoomIn()}
        title="Zoom in"
      >
        <Plus className={styles.iconSm} />
      </button>

      <div className={styles.divider} />

      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => setDownloadOpen(true)}
        title="Export as image"
      >
        <ImageUp className={styles.icon} />
      </button>

      <button
        type="button"
        className={cn(styles.iconBtn, searchOpen && styles.active)}
        onClick={() => setSearchOpen((v) => !v)}
        title="Search"
      >
        <Search className={styles.icon} />
      </button>

      <button
        type="button"
        className={styles.iconBtn}
        onClick={onRotateDirection}
        title={`Layout: ${DIRECTION_LABEL[direction]} (click để xoay)`}
      >
        <ArrowLeftRight className={styles.icon} />
      </button>

      <button
        type="button"
        className={cn(styles.iconBtn, collapsedCount > 0 && styles.active)}
        onClick={handleCollapseToggle}
        title={collapsedCount > 0 ? `Expand all (${collapsedCount} đang collapsed)` : 'Collapse all'}
      >
        {collapsedCount > 0 ? (
          <CopyPlus className={styles.icon} />
        ) : (
          <CopyMinus className={styles.icon} />
        )}
      </button>

      <div className={styles.divider} />

      <PreferencesMenu />

      {searchOpen && (
        <div className={styles.searchBox}>
          <Search className="h-3.5 w-3.5 opacity-70" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Tìm key/value..."
            className={styles.searchInput}
          />
          <span className={styles.searchCount}>{query ? `${matches}` : ''}</span>
        </div>
      )}

      <DownloadImageDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        graphRef={graphRef}
        defaultFilename={defaultExportName}
      />
    </div>
  );
}