// ============================================================
// PDF Studio Edit PDF - Context toolbar (appears on selection)
// ============================================================
// Fixed: color picker giờ CONTROLLED (key={color} remount khi selection đổi),
// thêm Duplicate + Bring forward/back + gesture wrapping cho history.
// ============================================================

import { Trash2, Copy, ChevronsUp, ChevronsDown } from 'lucide-react';
import { useEditorStore } from '../../lib/useEditorStore';
import { createId } from '../../lib/editor-objects';
import type { EditorObject } from '../../lib/editor-objects';

export function ContextToolbar() {
  const {
    objects,
    selectedIds,
    deleteObjects,
    updateObject,
    addObject,
    select,
    startGesture,
    commitGesture,
  } = useEditorStore();
  const selected = objects.filter((o) => selectedIds.includes(o.id));

  if (selected.length === 0) return null;

  const first = selected[0];

  // Extract current color để dùng làm value picker (controlled)
  const getObjColor = (o: EditorObject): string => {
    if (o.type === 'text' || o.type === 'text-replacement') return o.color;
    if (o.type === 'shape') return o.strokeColor;
    if (o.type === 'symbol') return o.color;
    if (o.type === 'path' || o.type === 'highlight') return o.color;
    return '#000000';
  };
  const currentColor = getObjColor(first);

  const handleColorChange = (color: string) => {
    startGesture();
    for (const obj of selected) {
      if (obj.type === 'text' || obj.type === 'text-replacement') {
        updateObject(obj.id, { color } as Partial<EditorObject>);
      } else if (obj.type === 'shape' || obj.type === 'symbol') {
        updateObject(obj.id, { strokeColor: color } as Partial<EditorObject>);
      } else if (obj.type === 'path' || obj.type === 'highlight') {
        updateObject(obj.id, { color } as Partial<EditorObject>);
      }
    }
    commitGesture('Change color');
  };

  const handleDuplicate = () => {
    const newIds: string[] = [];
    for (const obj of selected) {
      const clone = { ...obj, id: createId(), x: obj.x + 20, y: obj.y + 20 } as EditorObject;
      addObject(clone);
      newIds.push(clone.id);
    }
    select(newIds);
  };

  const bringForward = () => {
    startGesture();
    const maxLayer = objects.reduce((max, o) => Math.max(max, o.layerOrder), 0);
    for (const obj of selected) {
      updateObject(obj.id, { layerOrder: maxLayer + 1 } as Partial<EditorObject>);
    }
    commitGesture('Bring forward');
  };

  const sendBackward = () => {
    startGesture();
    const minLayer = objects.reduce((min, o) => Math.min(min, o.layerOrder), 0);
    for (const obj of selected) {
      updateObject(obj.id, { layerOrder: minLayer - 1 } as Partial<EditorObject>);
    }
    commitGesture('Send backward');
  };

  return (
    <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-1.5 text-xs">
      <span className="capitalize text-muted-foreground">
        {first.type}
        {selected.length > 1 && ` (+${selected.length - 1})`}
      </span>

      {/* Color picker - CONTROLLED bằng key remount */}
      <label className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Mau:</span>
        <input
          key={currentColor}
          type="color"
          value={currentColor}
          onChange={(e) => handleColorChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-input p-0.5"
        />
      </label>

      {/* Duplicate */}
      <button
        onClick={handleDuplicate}
        className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Nhan doi (Ctrl+D)"
      >
        <Copy className="h-3.5 w-3.5" />
        <span>Nhan doi</span>
      </button>

      {/* Z-order */}
      <button
        onClick={bringForward}
        className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Dua len tren"
      >
        <ChevronsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={sendBackward}
        className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Dua xuong duoi"
      >
        <ChevronsDown className="h-3.5 w-3.5" />
      </button>

      {/* Delete */}
      <button
        onClick={() => deleteObjects(selectedIds)}
        className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-destructive transition-colors hover:bg-destructive/10"
        title="Xoa (Delete)"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span>Xoa</span>
      </button>
    </div>
  );
}
