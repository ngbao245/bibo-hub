import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Eye,
  EyeOff,
  MoreVertical,
  ExternalLink,
  Trash2,
  Pencil,
  Plus,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';

import BookmarkItem from './BookmarkItem';
import type { Bookmark, BookmarkCategory } from '../types';
import { CATEGORY_NAME_MAX } from '../schemas';

// ============================================================
// CategoryBlock — dense Superdense-style
// Whole header row acts as drag handle. Kebab menu / status dot / rename
// input excluded via stopPropagation.
// ============================================================

interface CategoryBlockProps {
  category: BookmarkCategory;
  bookmarks: Bookmark[];
  hoverTitle: string | null;
  matchesSearch: (b: Bookmark) => boolean;
  iconSize: number;
  iconBackdrop: boolean;
  pageIsPublic: boolean;
  editMode: boolean;
  openInSameTab: boolean;
  readOnly?: boolean;
  onEditBookmark?: (b: Bookmark) => void;
  onHoverBookmark?: (title: string | null) => void;
  onQuickAdd?: (categoryId: string, url: string) => void;
  onOpenAll?: () => void;
  onToggleHidden?: () => void;
  onRename?: (name: string) => void;
  onDelete?: () => void;
}

export default function CategoryBlock({
  category,
  bookmarks,
  hoverTitle,
  matchesSearch,
  iconSize,
  iconBackdrop,
  pageIsPublic,
  editMode,
  openInSameTab,
  readOnly = false,
  onEditBookmark,
  onHoverBookmark,
  onQuickAdd,
  onOpenAll,
  onToggleHidden,
  onRename,
  onDelete,
}: CategoryBlockProps) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(category.name);
  const [adding, setAdding] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const categoryRootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover-intent close: menu giữ mở khi cursor còn trong CategoryBlock (header
  // + bookmark grid + add button) HOẶC trong DropdownContent (portal ngoài DOM).
  // Rời cả 2 vùng > DELAY ms => đóng. Chỉ react khi cursor MOVE — đứng im ko đóng.
  useEffect(() => {
    if (!menuOpen) return;

    const PADDING = 3;
    const DELAY = 100;

    function isInside(x: number, y: number, el: HTMLElement | null): boolean {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return (
        x >= r.left - PADDING &&
        x <= r.right + PADDING &&
        y >= r.top - PADDING &&
        y <= r.bottom + PADDING
      );
    }

    function clearTimer() {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    }

    function handleMove(e: MouseEvent) {
      const inside =
        isInside(e.clientX, e.clientY, categoryRootRef.current) ||
        isInside(e.clientX, e.clientY, contentRef.current);
      if (inside) {
        clearTimer();
      } else if (!closeTimerRef.current) {
        closeTimerRef.current = setTimeout(() => {
          closeTimerRef.current = null;
          setMenuOpen(false);
        }, DELAY);
      }
    }

    document.addEventListener('mousemove', handleMove);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      clearTimer();
    };
  }, [menuOpen]);

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `cat-drop:${category.id}`,
    data: { type: 'category', categoryId: category.id },
    disabled: readOnly,
  });

  const {
    attributes: sortAttributes,
    listeners: sortListeners,
    setNodeRef: setSortRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `cat:${category.id}`,
    disabled: readOnly,
    data: { type: 'category-drag', categoryId: category.id },
  });

  const wrapperStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  function submitRename() {
    const clean = nameDraft.trim();
    if (clean.length === 0 || clean === category.name) {
      setNameDraft(category.name);
      setRenaming(false);
      return;
    }
    onRename?.(clean);
    setRenaming(false);
  }

  function submitAdd(e: FormEvent) {
    e.preventDefault();
    const clean = urlDraft.trim();
    if (!/^https?:\/\//i.test(clean)) return;
    onQuickAdd?.(category.id, clean);
    setUrlDraft('');
    setAdding(false);
  }

  const bookmarkIds = bookmarks.map((b) => b.id);

  const showVisibilityBadge = !readOnly && pageIsPublic && editMode;

  // Stop pointerdown on interactive controls from initiating drag
  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      ref={(el) => {
        setSortRef(el);
        setDropRef(el);
        categoryRootRef.current = el;
      }}
      style={wrapperStyle}
      className={cn(
        'bookmark-category group/cat rounded-md p-1 -m-1 transition-colors duration-150',
        isOver && 'ring-2 ring-primary/60 bg-primary/5',
      )}
    >
      {/* Header row = drag handle (whole row) */}
      <div
        {...(readOnly || renaming ? {} : sortAttributes)}
        {...(readOnly || renaming ? {} : sortListeners)}
        className={cn(
          'mb-2 flex items-center gap-1.5',
          !readOnly && !renaming && 'cursor-grab active:cursor-grabbing',
        )}
      >
        {showVisibilityBadge && (
          <button
            type="button"
            onClick={onToggleHidden}
            onPointerDown={stopDrag}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-150',
              category.hiddenFromPublic
                ? 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                : 'bg-success/15 text-success hover:bg-success/25',
            )}
            title={
              category.hiddenFromPublic
                ? 'Đang ẩn — click để hiện trên public'
                : 'Đang public — click để ẩn'
            }
            aria-label="Toggle visibility"
          >
            {category.hiddenFromPublic ? (
              <>
                <EyeOff className="h-3 w-3" /> Hidden
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" /> Public
              </>
            )}
          </button>
        )}

        {renaming ? (
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') {
                setNameDraft(category.name);
                setRenaming(false);
              }
            }}
            autoFocus
            maxLength={CATEGORY_NAME_MAX}
            className="h-6 flex-1 max-w-[220px] text-xs"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!readOnly) setRenaming(true);
            }}
            className="bookmark-category-badge inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm"
            title={readOnly ? undefined : 'Double-click để đổi tên · kéo để di chuyển'}
          >
            {category.name}
          </span>
        )}

        {!readOnly && (
          <div
            className="ml-auto opacity-0 transition-opacity duration-150 group-hover/cat:opacity-100 focus-within:opacity-100"
            onPointerDown={stopDrag}
          >
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label="Category actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent ref={contentRef} align="end">
                {bookmarks.length > 0 && (
                  <DropdownMenuItem onClick={onOpenAll}>
                    <ExternalLink className="h-3.5 w-3.5" /> Open all
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setRenaming(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Icon grid */}
      <div
        className="flex flex-wrap items-center gap-1.5 p-0.5"
        style={{ minHeight: iconSize + 4 }}
      >
        <SortableContext items={bookmarkIds} strategy={horizontalListSortingStrategy}>
          <ul className="contents m-0 p-0" style={{ listStyle: 'none' }}>
            {bookmarks.map((b) => (
              <BookmarkItem
                key={b.id}
                bookmark={b}
                readOnly={readOnly}
                faded={!matchesSearch(b)}
                iconSize={iconSize}
                iconBackdrop={iconBackdrop}
                openInSameTab={openInSameTab}
                onClick={() => onEditBookmark?.(b)}
                onHover={onHoverBookmark}
              />
            ))}
          </ul>
        </SortableContext>

        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            onPointerDown={stopDrag}
            className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/25 bg-transparent text-muted-foreground/50 transition-all duration-150 hover:border-muted-foreground/60 hover:bg-muted hover:text-foreground"
            style={{ width: iconSize, height: iconSize }}
            title="Thêm bookmark"
            aria-label="Thêm bookmark"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={submitAdd} onPointerDown={stopDrag} className="mt-2 flex items-center gap-1">
          <Input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://…"
            className="h-7 flex-1 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setUrlDraft('');
                setAdding(false);
              }
            }}
          />
          <Button size="sm" type="submit" className="h-7 gap-1 text-xs">
            <Plus className="h-3 w-3" /> Add
          </Button>
          <Button
            size="icon"
            type="button"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => {
              setUrlDraft('');
              setAdding(false);
            }}
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </form>
      )}

      <p
        className={cn(
          'bibo-bookmark-hover-title mt-1.5 min-h-[14px] text-[11px] text-muted-foreground/70 transition-opacity duration-150',
          hoverTitle ? 'opacity-100' : 'opacity-0',
        )}
      >
        {hoverTitle || '\u00A0'}
      </p>
    </div>
  );
}
