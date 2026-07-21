import { useMemo } from 'react';
import { Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { escapeHtml, highlightJson } from '@/tools/json-studio/lib/json-highlight';
import type { NodeData } from '@/tools/json-studio/lib/types';
import { cn } from '@/lib/cn';

// ============================================================
// NodeDetailsDialog - hiển thị Content + JSON Path khi click vào node
// Port từ jsoncrack-react NodeModal.tsx (Apache 2.0).
// Khác bản gốc:
//  - shadcn Dialog + token theme của hubibo (jsoncrack dùng Mantine).
//  - syntax highlight JSON dùng `lib/json-viewer/json-highlight` (regex
//    1-pass) thay vì shiki để tránh ~2MB JS+WASM cho 1 modal hiếm khi mở.
// ============================================================

interface NodeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeData: NodeData | null;
}

// Quy đổi rows trong NodeData → JSON object/value để hiển thị.
// Giữ nguyên logic jsoncrack:
//  - rỗng                                       → "{}"
//  - 1 row primitive (key null)                 → in ra value
//  - còn lại                                    → gom thành object,
//    bỏ qua container rows (array/object) vì children ở node khác.
const normalizeNodeData = (rows: NodeData['text'] | undefined): string => {
  if (!rows || rows.length === 0) return '{}';
  if (rows.length === 1 && !rows[0].key) {
    const v = rows[0].value;
    return v === null ? 'null' : `${v}`;
  }

  const obj: Record<string, unknown> = {};
  for (const row of rows) {
    if (row.type !== 'array' && row.type !== 'object' && row.key) {
      obj[row.key] = row.value;
    }
  }
  return JSON.stringify(obj, null, 2);
};

// Build chuỗi JSON path kiểu `$[0]["contents"][3]`
const jsonPathToString = (path?: NodeData['path']): string => {
  if (!path || path.length === 0) return '$';
  const segments = path.map((seg) =>
    typeof seg === 'number' ? `${seg}` : `"${seg}"`
  );
  return `$[${segments.join('][')}]`;
};

interface CodeBlockProps {
  code: string;
  language?: 'json' | 'plain';
  maxHeight?: string;
  className?: string;
}

const CodeBlock = ({
  code,
  language = 'json',
  maxHeight,
  className,
}: CodeBlockProps) => {
  const html = useMemo(
    () => (language === 'json' ? highlightJson(code) : escapeHtml(code)),
    [code, language]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Đã copy vào clipboard');
    } catch {
      toast.error('Không copy được');
    }
  };

  return (
    <div
      className={cn(
        // Background tối hơn card 1 chút để code block tách layer rõ.
        // `min-w-0` cần cho parent flex/grid để overflow-auto trên <pre>
        // hoạt động (không bị parent giãn theo min-content của code dài).
        'relative min-w-0 border border-border bg-[#1d1f21]',
        className
      )}
    >
      <button
        type="button"
        aria-label="Copy code"
        onClick={handleCopy}
        className={cn(
          'absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center',
          'border border-border bg-card text-muted-foreground transition-colors',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        )}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <pre
        className="overflow-auto whitespace-pre p-3 pr-10 font-mono text-xs leading-relaxed"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
};

export const NodeDetailsDialog = ({
  open,
  onOpenChange,
  nodeData,
}: NodeDetailsDialogProps) => {
  const content = useMemo(() => normalizeNodeData(nodeData?.text), [nodeData]);
  const jsonPath = useMemo(() => jsonPathToString(nodeData?.path), [nodeData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Node Content</DialogTitle>
        </DialogHeader>

        {/* `min-w-0` ở mọi cấp wrapper: DialogContent là grid, mặc định
            grid item có `min-width: auto` → giãn theo min-content của con.
            Pre với code rất dài (vd content HTML escaped) sẽ kéo cell
            vượt khỏi max-w-[600px]. Set min-w-0 để cell co lại, lúc đó
            `overflow-auto` trên <pre> mới kích hoạt scroll ngang. */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-xs font-medium text-foreground">Content</p>
            <CodeBlock code={content} maxHeight="250px" />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-xs font-medium text-foreground">JSON Path</p>
            <CodeBlock code={jsonPath} maxHeight="250px" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};