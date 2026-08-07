// ============================================================
// PDF Studio Edit PDF — Edit Text overlay (region detection + inline edit)
// ============================================================
// Shows detected text regions when Edit Text tool is active.
// Single click: select region (resize handles). 
// Double click: open inline editor for visual replacement.
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import type { TextRegion } from '../../lib/text-detection';
import type { ViewportTransform, TextReplacementObject } from '../../lib/editor-objects';
import { createId } from '../../lib/editor-objects';
import { useEditorStore } from '../../lib/useEditorStore';

interface EditTextOverlayProps {
  regions: TextRegion[];
  transform: ViewportTransform;
  active: boolean;
}

export function EditTextOverlay({ regions, transform, active }: EditTextOverlayProps) {
  const { addObject } = useEditorStore();
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when deactivated
  useEffect(() => {
    if (!active) {
      setSelectedRegionId(null);
      setEditingRegionId(null);
      setEditContent('');
    }
  }, [active]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (editingRegionId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingRegionId]);

  const handleRegionClick = useCallback((e: React.MouseEvent, region: TextRegion) => {
    e.stopPropagation();
    if (editingRegionId) return; // Don't change selection while editing
    setSelectedRegionId(region.id);
  }, [editingRegionId]);

  const handleRegionDoubleClick = useCallback((e: React.MouseEvent, region: TextRegion) => {
    e.stopPropagation();
    setSelectedRegionId(region.id);
    setEditingRegionId(region.id);
    setEditContent(region.content);
  }, []);

  const handleCommitEdit = useCallback((region: TextRegion) => {
    if (!editContent.trim()) {
      setEditingRegionId(null);
      return;
    }

    if (editContent === region.content) {
      // No change
      setEditingRegionId(null);
      return;
    }

    // Check background complexity (simple heuristic: always allow for now, Builder Task 14 will refine)
    // Create text-replacement object
    const replacement: TextReplacementObject = {
      id: createId(),
      type: 'text-replacement',
      pageId: region.pageId,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      rotation: 0,
      opacity: 100,
      layerOrder: Date.now(),
      locked: false,
      originalBounds: { x: region.x, y: region.y, width: region.width, height: region.height },
      content: editContent,
      fontFamily: region.fontFamily || 'Helvetica',
      fontSize: region.fontSize,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#000000',
      backgroundColor: '#ffffff',
    };

    addObject(replacement);
    toast.success('Da thay the noi dung vung text.');
    setEditingRegionId(null);
    setSelectedRegionId(null);
  }, [editContent, addObject]);

  const handleCancelEdit = useCallback(() => {
    setEditingRegionId(null);
    setEditContent('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, region: TextRegion) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommitEdit(region);
    }
  }, [handleCancelEdit, handleCommitEdit]);

  if (!active || regions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-auto" style={{ zIndex: 4 }}>
      {regions.map((region) => {
        // region.x, region.y are document points, top-left origin
        const scale = transform.scale;
        const fontPx = region.fontSize * scale;
        const left = region.x * scale;
        const w = region.width * scale;
        const h = region.height * scale;
        // The detected region height is inflated above the glyph, so the box looks
        // top-heavy. Nudge the WHOLE box down by half the inflation to balance it
        // vertically over the original text line (text inside stays top-aligned).
        const inflation = Math.max(0, h - fontPx);
        const vOffset = inflation / 2;
        const top = region.y * scale + vOffset;
        const isSelected = selectedRegionId === region.id;
        const isEditing = editingRegionId === region.id;

        return (
          <div
            key={region.id}
            className="absolute"
            style={{ left, top, width: w, height: h }}
            onClick={(e) => handleRegionClick(e, region)}
            onDoubleClick={(e) => handleRegionDoubleClick(e, region)}
          >
            {/* Always visible dashed outline; hover = solid highlight; selected = primary */}
            {!isEditing && (
              <div
                className={`absolute inset-0 rounded-sm transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-2 border-primary bg-primary/5'
                    : 'border border-dashed border-primary/40 hover:border-solid hover:border-primary/70 hover:bg-primary/5'
                }`}
              />
            )}

            {/* Resize handles when selected */}
            {isSelected && !isEditing && (
              <>
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-primary rounded-full cursor-nw-resize" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full cursor-ne-resize" />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary rounded-full cursor-sw-resize" />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary rounded-full cursor-se-resize" />
              </>
            )}

            {/* Inline editor */}
            {isEditing && (
              <div className="absolute inset-0 z-10">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, region)}
                  onBlur={() => handleCommitEdit(region)}
                  className="w-full h-full resize-none border-2 border-primary bg-white/95 px-1 py-0.5 text-foreground outline-none"
                  style={{
                    fontSize: fontPx,
                    fontFamily: region.fontFamily,
                    lineHeight: 1.2,
                  }}
                />
                <div className="absolute -bottom-6 left-0 flex gap-1 text-[9px]">
                  <span className="bg-muted px-1 rounded text-muted-foreground">Enter: luu</span>
                  <span className="bg-muted px-1 rounded text-muted-foreground">Esc: huy</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
