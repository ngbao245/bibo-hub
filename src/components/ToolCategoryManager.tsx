
import { useEffect, useMemo, useState } from 'react';
import { X, Save, GripVertical } from 'lucide-react';

import { TOOLS, TOOL_GROUPS, type Tool } from '@/lib/tools';
import {
  useToolCategories,
  useSaveToolCategories,
  type ToolCategoriesData,
} from '@/api/toolCategories';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

// ============================================================
// ToolCategoryManager — drag-drop tools giữa categories
// ============================================================
//
// 6 category fix cứng (Productivity/Finance/Tracking/Utilities/Developer/Admin)
// — user KHÔNG thêm/xoá được. Chỉ được reorder + gán tool vào category.
// Default: tất cả tool unassigned. User kéo về category tương ứng.
// ============================================================

const DEFAULT_CATEGORIES: string[] = [...TOOL_GROUPS];

export default function ToolCategoryManager({
  onDirtyChange,
}: {
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const catQuery = useToolCategories();
  const saveMut = useSaveToolCategories();

  const [categories, setCategories] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [draggedToolId, setDraggedToolId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Notify parent of dirty state
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!catQuery.data) return;
    const d = catQuery.data.data;
    if (d.categories.length > 0) {
      setCategories(d.categories);
      setMapping(d.mapping);
    } else {
      // Chưa config → 6 category rỗng, tất cả tool unassigned
      setCategories(DEFAULT_CATEGORIES);
      setMapping({});
    }
  }, [catQuery.data]);

  function moveTool(toolId: string, toCat: string) {
    setMapping((prev) => ({ ...prev, [toolId]: toCat }));
    setDirty(true);
  }

  function removeTool(toolId: string) {
    setMapping((prev) => {
      const next = { ...prev };
      delete next[toolId];
      return next;
    });
    setDirty(true);
  }

  function handleSave() {
    const data: ToolCategoriesData = { categories, mapping };
    saveMut.mutate(
      { data, recordId: catQuery.data?.recordId ?? null },
      {
        onSuccess: () => {
          toast.success('Đã lưu categories');
          setDirty(false);
        },
        onError: () => toast.error('Lỗi lưu'),
      },
    );
  }

  // Drag handlers
  function handleDragStart(toolId: string) {
    setDraggedToolId(toolId);
  }

  function handleDragEnd() {
    setDraggedToolId(null);
    setDropTarget(null);
  }

  function handleDropOnCategory(cat: string) {
    if (draggedToolId) {
      moveTool(draggedToolId, cat);
    }
    setDraggedToolId(null);
    setDropTarget(null);
  }

  function handleDropOnUnassigned() {
    if (draggedToolId) {
      removeTool(draggedToolId);
    }
    setDraggedToolId(null);
    setDropTarget(null);
  }

  const unassigned = useMemo(
    () => TOOLS.filter((t) => !mapping[t.id] || !categories.includes(mapping[t.id])),
    [mapping, categories],
  );

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-end gap-2 pb-2">
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={saveMut.isPending} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saveMut.isPending ? 'Đang lưu...' : 'Save'}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {categories.map((cat) => {
            const tools = TOOLS.filter((t) => mapping[t.id] === cat);
            const isOver = dropTarget === cat;
            return (
              <div
                key={cat}
                onDragOver={(e) => {
                  // Cho phép drop bằng cách preventDefault.
                  // Set dropTarget chỉ khi đang drag (tránh nhiễu khi
                  // text selection drag).
                  if (!draggedToolId) return;
                  e.preventDefault();
                  if (dropTarget !== cat) setDropTarget(cat);
                }}
                onDragLeave={(e) => {
                  // Chỉ reset khi cursor thực sự rời khỏi container.
                  // dragleave fire cả khi vào child → check relatedTarget.
                  const next = e.relatedTarget as Node | null;
                  if (next && e.currentTarget.contains(next)) return;
                  setDropTarget((prev) => (prev === cat ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnCategory(cat);
                }}
                className={cn(
                  'border p-3 transition-colors',
                  isOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card',
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {cat}
                    <span className="ml-1.5 font-mono font-normal text-muted-foreground">
                      ({tools.length})
                    </span>
                  </h3>
                </div>
                {tools.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-muted-foreground">
                    {isOver ? 'Thả vào đây' : 'Kéo tool vào đây'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {tools.map((tool) => (
                      <ToolChip
                        key={tool.id}
                        tool={tool}
                        isDragging={draggedToolId === tool.id}
                        onDragStart={() => handleDragStart(tool.id)}
                        onDragEnd={handleDragEnd}
                        onRemove={() => removeTool(tool.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned drop zone */}
          <div
            onDragOver={(e) => {
              if (!draggedToolId) return;
              e.preventDefault();
              if (dropTarget !== '__unassigned') setDropTarget('__unassigned');
            }}
            onDragLeave={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && e.currentTarget.contains(next)) return;
              setDropTarget((prev) => (prev === '__unassigned' ? null : prev));
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnUnassigned();
            }}
            className={cn(
              'border border-dashed p-3 transition-colors',
              dropTarget === '__unassigned'
                ? 'border-warning bg-warning/5'
                : 'border-border',
            )}
          >
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Unassigned ({unassigned.length})
            </h3>
            {unassigned.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {dropTarget === '__unassigned' ? 'Thả để bỏ assign' : 'Tất cả tools đã được gán'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {unassigned.map((tool) => (
                  <ToolChip
                    key={tool.id}
                    tool={tool}
                    isDragging={draggedToolId === tool.id}
                    onDragStart={() => handleDragStart(tool.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="pt-2 text-[11px] text-muted-foreground">
            6 category cố định, không thêm/xoá được. Kéo tool giữa các category
            hoặc bỏ về Unassigned để ẩn khỏi Hub.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ToolChip — draggable tool badge
// ============================================================
function ToolChip({
  tool,
  isDragging,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  tool: Tool;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        // Set dummy data để Firefox cho drag
        e.dataTransfer.setData('text/plain', tool.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      // Cho phép cursor qua chip mà drop vẫn valid (bubble lên parent container)
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        'group flex cursor-grab items-center gap-1 select-none border border-border bg-background px-2 py-1 text-xs transition-opacity active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="pointer-events-none font-medium text-foreground">
        {tool.label}
      </span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hidden text-muted-foreground hover:text-destructive group-hover:inline-flex"
          title="Bỏ assign"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}