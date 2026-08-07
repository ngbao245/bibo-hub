// ============================================================
// PDF Studio Shared — File/Page card (228x302, PSPDFKit-style)
// ============================================================
// Reusable card for Merge (file-level) and Split (page-level).
// Renders thumbnail canvas + label + optional sublabel/badge.
// Must be wrapped in dnd-kit sortable for drag reorder.
// ============================================================

import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { CardHoverActions } from './CardHoverActions';

interface FilePageCardProps {
  /** Thumbnail canvas element (pre-rendered offscreen) */
  thumbnailCanvas?: HTMLCanvasElement | null;
  /** Primary label (filename or page number) */
  label: string;
  /** Secondary label (e.g. "4 pages" or page number) */
  sublabel?: string;
  /** Whether card is currently selected */
  selected?: boolean;
  /** Hover actions callbacks */
  onPreview?: () => void;
  onDuplicate?: () => void;
  onRotate?: () => void;
  onDelete?: () => void;
  /** Card click handler */
  onClick?: () => void;
  /** Additional className */
  className?: string;
  /** Drag handle attributes (from dnd-kit) */
  dragAttributes?: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
  /** Opacity/transform style from dnd-kit */
  style?: React.CSSProperties;
}

export const FilePageCard = forwardRef<HTMLDivElement, FilePageCardProps>(
  function FilePageCard(
    {
      thumbnailCanvas,
      label,
      sublabel,
      selected,
      onPreview,
      onDuplicate,
      onRotate,
      onDelete,
      onClick,
      className,
      dragAttributes,
      dragListeners,
      style,
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onClick}
        className={cn(
          'group/item relative m-1 box-border flex h-[302px] w-[228px] cursor-move flex-col items-center gap-3 rounded-lg px-1 py-3 transition-all',
          selected ? 'bg-primary/15 ring-2 ring-primary' : 'bg-primary/5 hover:bg-primary/10',
          className,
        )}
        style={style}
        {...dragAttributes}
        {...dragListeners}
      >
        {/* Hover actions */}
        <CardHoverActions
          onPreview={onPreview}
          onDuplicate={onDuplicate}
          onRotate={onRotate}
          onDelete={onDelete}
        />

        {/* Thumbnail area */}
        <div className="flex h-[220px] w-[156px] items-center justify-center">
          {thumbnailCanvas ? (
            <canvas
              ref={(el) => {
                if (el && thumbnailCanvas) {
                  el.width = thumbnailCanvas.width;
                  el.height = thumbnailCanvas.height;
                  const ctx = el.getContext('2d');
                  if (ctx) ctx.drawImage(thumbnailCanvas, 0, 0);
                }
              }}
              className="max-h-full max-w-full rounded border border-border bg-background shadow-md"
              style={{ display: 'block' }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded border border-border bg-muted/30">
              <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
          )}
        </div>

        {/* Label */}
        <div className="flex w-full flex-col items-center gap-0.5 px-2">
          <p className="w-full truncate text-center text-xs text-foreground">{label}</p>
          {sublabel && (
            <p className="text-[11px] text-muted-foreground">{sublabel}</p>
          )}
        </div>
      </div>
    );
  },
);
