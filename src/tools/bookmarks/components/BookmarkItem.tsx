import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import BookmarkFavicon from './BookmarkFavicon';
import type { Bookmark } from '../types';

interface BookmarkItemProps {
  bookmark: Bookmark;
  iconSize: number;
  iconBackdrop: boolean;
  openInSameTab: boolean;
  readOnly?: boolean;
  faded?: boolean;
  onClick?: () => void;
  onHover?: (title: string | null) => void;
}

export default function BookmarkItem({
  bookmark,
  iconSize,
  iconBackdrop,
  openInSameTab,
  readOnly = false,
  faded = false,
  onClick,
  onHover,
}: BookmarkItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bookmark.id,
    disabled: readOnly,
    data: { type: 'bookmark', categoryId: bookmark.categoryId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : faded ? 0.15 : 1,
  };

  const tooltip = bookmark.title || bookmark.url;

  const content = (
    <BookmarkFavicon
      faviconUrl={bookmark.faviconUrl}
      title={bookmark.title}
      url={bookmark.url}
      size={iconSize}
      backdrop={iconBackdrop}
      iconType={bookmark.iconType}
      iconText={bookmark.iconText}
      iconRounded={bookmark.iconRounded}
      iconBackground={bookmark.iconBackground}
      className=""
    />
  );

  const target = openInSameTab ? '_self' : '_blank';

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...(readOnly ? {} : attributes)}
      {...(readOnly ? {} : listeners)}
      onMouseEnter={() => onHover?.(tooltip)}
      onMouseLeave={() => onHover?.(null)}
      title={tooltip}
      className="group/tile cursor-pointer transition-opacity"
      aria-hidden={faded || undefined}
    >
      {readOnly ? (
        <a
          href={bookmark.url}
          target={target}
          rel={openInSameTab ? undefined : 'noopener noreferrer'}
          className="block"
          aria-label={bookmark.title || bookmark.url.replace(/^https?:\/\//, '').replace(/\/$/, '') || bookmark.url}
          tabIndex={faded ? -1 : undefined}
        >
          {content}
        </a>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            if (!isDragging) onClick?.();
            e.stopPropagation();
          }}
          className="block bg-transparent p-0"
          aria-label={`Edit ${bookmark.title || bookmark.url}`}
          tabIndex={faded ? -1 : undefined}
        >
          {content}
        </button>
      )}
    </li>
  );
}
