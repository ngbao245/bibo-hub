import { useMemo } from 'react';
import { FileJson, PanelLeftOpen } from 'lucide-react';
import { useJsonStudioStore } from '@/tools/json-studio/store';
import { cn } from '@/lib/cn';

// ============================================================
// DataMetaBadge — badge compact hiển thị meta của data đang active
// ============================================================
//
// Dùng ở header workspace Schema / TS Bridge (những tab không có preview
// pane cho data). User bấm badge → mở editor rail (nếu đang collapse) để
// thấy data đầy đủ.
//
// Meta gồm: filename · format · size (chars) · top-level keys count.
// ============================================================

export function DataMetaBadge() {
  const rawData = useJsonStudioStore((s) => s.rawData);
  const filename = useJsonStudioStore((s) => s.sourceFilename);
  const format = useJsonStudioStore((s) => s.sourceFormat);
  const editorOpen = useJsonStudioStore((s) => s.editorOpen);
  const setEditorOpen = useJsonStudioStore((s) => s.setEditorOpen);

  const meta = useMemo(() => {
    try {
      const stringified = JSON.stringify(rawData);
      const size = stringified.length;
      let keyCount = 0;
      if (Array.isArray(rawData)) {
        keyCount = rawData.length;
      } else if (rawData && typeof rawData === 'object') {
        keyCount = Object.keys(rawData as Record<string, unknown>).length;
      }
      return { size, keyCount };
    } catch {
      return { size: 0, keyCount: 0 };
    }
  }, [rawData]);

  const sizeLabel =
    meta.size < 1024 ? `${meta.size} B` : `${(meta.size / 1024).toFixed(1)} KB`;
  const keyLabel = Array.isArray(rawData) ? `${meta.keyCount} items` : `${meta.keyCount} keys`;

  const meta_content = (
    <>
      <FileJson className="h-3 w-3 shrink-0" />
      <span className="font-medium">{filename}</span>
      <span className="uppercase">({format})</span>
      <span className="text-muted-foreground/60">·</span>
      <span className="tabular-nums">{sizeLabel}</span>
      <span className="text-muted-foreground/60">·</span>
      <span>{keyLabel}</span>
    </>
  );

  // Editor đang mở → badge chỉ là info, không cần action (đã có nút đóng
  // trong DataEditor header).
  if (editorOpen) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground'
        )}
      >
        {meta_content}
      </div>
    );
  }

  // Editor đang đóng → badge là action "mở editor".
  return (
    <button
      type="button"
      onClick={() => setEditorOpen(true)}
      title="Mở editor để xem/chỉnh data"
      className={cn(
        'inline-flex items-center gap-1.5 border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors',
        'hover:border-primary/50 hover:bg-primary/5 hover:text-foreground'
      )}
    >
      {meta_content}
      <PanelLeftOpen className="ml-0.5 h-3 w-3 shrink-0 opacity-60" />
    </button>
  );
}