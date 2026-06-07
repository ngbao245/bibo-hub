import { useState } from 'react';
import { Sun, Star, CheckCircle2, Inbox, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

import type { List, Task } from '@/schemas/task';
import { countTasks, type TaskListFilter } from '@/lib/taskFilters';

// ============================================================
// TaskSidebar - 4 filter built-in + custom lists
// ============================================================

interface TaskSidebarProps {
  tasks: Task[];
  lists: List[];
  selected: TaskListFilter;
  onSelect: (filter: TaskListFilter) => void;
  onCreateList: (title: string) => void;
  onDeleteList: (id: string) => void;
}

export default function TaskSidebar({
  tasks,
  lists,
  selected,
  onSelect,
  onCreateList,
  onDeleteList,
}: TaskSidebarProps) {
  const [newListInput, setNewListInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const counts = countTasks(tasks);

  function handleCreate() {
    const title = newListInput.trim();
    if (!title) return;
    onCreateList(title);
    setNewListInput('');
    setShowInput(false);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border bg-muted px-3 py-2">
        <h3 className="text-sm font-medium uppercase tracking-wider text-secondary-foreground">
          Tasks
        </h3>
      </div>

      <nav className="flex-1 overflow-y-auto p-1">
        {/* Built-in lists */}
        <FilterRow
          icon={<Sun className="h-4 w-4" />}
          label="Hôm nay"
          count={counts.today}
          active={selected === 'today'}
          onClick={() => onSelect('today')}
        />
        <FilterRow
          icon={<Star className="h-4 w-4" />}
          label="Quan trọng"
          count={counts.important}
          active={selected === 'important'}
          onClick={() => onSelect('important')}
        />
        <FilterRow
          icon={<Inbox className="h-4 w-4" />}
          label="Tất cả"
          count={counts.all}
          active={selected === 'all'}
          onClick={() => onSelect('all')}
        />
        <FilterRow
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Hoàn thành"
          count={counts.completed}
          active={selected === 'completed'}
          onClick={() => onSelect('completed')}
        />

        {/* Custom lists section */}
        {lists.length > 0 && <Divider label="Danh sách" />}

        {lists.map((list) => {
          const count = tasks.filter(
            (t) => t.parentId === list.id && t.status !== 'completed',
          ).length;
          return (
            <ListRow
              key={list.id}
              title={list.title || 'Untitled'}
              count={count}
              active={selected === list.id}
              onSelect={() => onSelect(list.id)}
              onDelete={() => {
                if (window.confirm(`Xoá danh sách "${list.title}"?`)) {
                  onDeleteList(list.id);
                }
              }}
            />
          );
        })}
      </nav>

      {/* New list input */}
      <div className="border-t border-border p-2">
        {showInput ? (
          <div className="flex gap-1">
            <Input
              value={newListInput}
              onChange={(e) => setNewListInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setShowInput(false);
                  setNewListInput('');
                }
              }}
              placeholder="Tên danh sách..."
              autoFocus
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={handleCreate} className="h-8 px-2">
              OK
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInput(true)}
            className="w-full justify-start gap-1.5 text-xs text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Danh sách mới
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
function FilterRow({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-popover text-foreground'
          : 'text-muted-foreground hover:bg-popover/50 hover:text-foreground',
      )}
    >
      <span className={cn('shrink-0', active && 'text-primary')}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {count > 0 && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

function ListRow({
  title,
  count,
  active,
  onSelect,
  onDelete,
}: {
  title: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-popover text-foreground'
          : 'text-muted-foreground hover:bg-popover/50 hover:text-foreground',
      )}
    >
      <button
        onClick={onSelect}
        className="flex flex-1 items-center gap-2 text-left"
      >
        <span className={cn('h-1.5 w-1.5 shrink-0 bg-current', active && 'bg-primary')} />
        <span className="flex-1 truncate">{title}</span>
        {count > 0 && (
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{count}</span>
        )}
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        title="Xoá danh sách"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mt-3 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
  );
}
