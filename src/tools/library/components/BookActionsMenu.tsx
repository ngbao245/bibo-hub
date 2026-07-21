import { useState } from 'react';
import { MoreVertical, Download, Upload, RefreshCw, Trash2, Pencil } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import type { Book } from '@/tools/library/lib/types';

interface Props {
  book: Book;
  canManage: boolean; // admin
  canRename: boolean; // uploader hoặc admin
  onExport: (book: Book) => void;
  onImport: (book: Book) => void;
  onRename: (book: Book) => void;
  onReplace: (book: Book) => void;
  onDelete: (book: Book) => void;
}

/**
 * Dropdown 3 chấm cho book card. Action theo role:
 * - User thường: Export, Import (vào chính sách này).
 * - Admin: + Replace file, Delete.
 *
 * Note: controlled `open` state. Trigger button luôn mounted trong DOM
 * (opacity thay display:none ở wrapper) để anchor Popover chuẩn.
 */
export default function BookActionsMenu({
  book,
  canManage,
  canRename,
  onExport,
  onImport,
  onRename,
  onReplace,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="bg-zinc-900/80 p-1 text-zinc-400 hover:text-zinc-100"
          title="Actions"
          onClick={(e) => {
            // Chặn bubble để tránh trigger Link parent (dù thực tế button là sibling
            // của Link, giữ defensive). KHÔNG preventDefault vì Radix Popover.Trigger
            // dùng composeEventHandlers: nó skip toggle logic khi event.defaultPrevented.
            e.stopPropagation();
          }}
        >
          <MoreVertical className="h-3 w-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 w-44 border border-zinc-700 bg-zinc-900 py-1 text-xs text-zinc-100 shadow-xl"
          onClick={(e) => e.stopPropagation()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <MenuItem
            icon={Download}
            label="Xuất ghi chú"
            onClick={() => runAction(() => onExport(book))}
          />
          <MenuItem
            icon={Upload}
            label="Nhập ghi chú"
            onClick={() => runAction(() => onImport(book))}
          />
          {canRename && (
            <MenuItem
              icon={Pencil}
              label="Đổi tên"
              onClick={() => runAction(() => onRename(book))}
            />
          )}
          {canManage && (
            <>
              <div className="my-1 border-t border-zinc-800" />
              <MenuItem
                icon={RefreshCw}
                label="Thay file PDF"
                onClick={() => runAction(() => onReplace(book))}
              />
              <MenuItem
                icon={Trash2}
                label="Xoá sách"
                onClick={() => runAction(() => onDelete(book))}
                danger
              />
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800 ${
        danger ? 'text-red-400 hover:text-red-300' : ''
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}