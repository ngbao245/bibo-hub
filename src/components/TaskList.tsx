import { useMemo, useState } from 'react';
import { Search, X, Plus, Star, Trash2, Calendar, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { formatDueDate } from '@/lib/focus';

import type { Task } from '@/schemas/task';
import {
  useToggleTask,
  useToggleImportant,
  useDeleteTask,
  useCreateTask,
} from '@/api/tasks';
import { sortTasks, filterTasks, type TaskListFilter } from '@/lib/taskFilters';
import { toast } from '@/components/ui/sonner';

// ============================================================
// TaskList - hiển thị tasks theo filter
// ============================================================

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  filter: TaskListFilter;
  /** Title hiển thị ở header (vd "Hôm nay", tên custom list...) */
  title: string;
}

export default function TaskList({ tasks, isLoading, filter, title }: TaskListProps) {
  const [query, setQuery] = useState('');
  const createTask = useCreateTask();

  // Lọc và sort tasks. useMemo để tránh tính lại mỗi render khác.
  const filtered = useMemo(() => {
    let list = filterTasks(tasks, filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
      );
    }
    return sortTasks(list);
  }, [tasks, filter, query]);

  const handleQuickAdd = (title: string) => {
    // Set parentId nếu đang ở custom list
    const parentId = !['all', 'today', 'important', 'completed'].includes(filter)
      ? filter
      : null;

    // Nếu đang ở "Hôm nay" → set dueDate = today
    const dueDate =
      filter === 'today' ? new Date().setHours(23, 59, 59, 999) : null;

    createTask.mutate(
      {
        title,
        parentId,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        priority: filter === 'important' ? 'high' : 'normal',
      },
      {
        onSuccess: () => toast.success('Đã thêm task'),
        onError: () => toast.error('Không thêm được task'),
      },
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}
        </p>
      </div>

      {/* Search */}
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm task..."
            className="h-8 pl-7 pr-7 text-xs"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Quick add */}
      <QuickAdd onAdd={handleQuickAdd} disabled={createTask.isPending} />

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {query ? `Không có task nào khớp "${query}"` : 'Chưa có task nào ở đây'}
          </div>
        ) : (
          <ul>
            {filtered.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================
function QuickAdd({
  onAdd,
  disabled,
}: {
  onAdd: (title: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState('');

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText('');
  }

  return (
    <div className="border-b border-border p-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Plus className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Thêm task mới..."
            disabled={disabled}
            className="h-8 pl-7 text-sm"
          />
        </div>
        {disabled && (
          <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const toggle = useToggleTask();
  const toggleImportant = useToggleImportant();
  const deleteTask = useDeleteTask();

  const due = task.dueDate ? formatDueDate(task.dueDate) : null;
  const dueColor = due
    ? {
        overdue: 'text-destructive',
        today: 'text-primary',
        soon: 'text-foreground',
        normal: 'text-muted-foreground',
      }[due.tone]
    : '';

  async function handleDelete() {
    if (!window.confirm(`Delete task "${task.title || 'Untitled'}"?`)) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => toast.success('Đã xoá'),
      onError: () => toast.error('Không xoá được'),
    });
  }

  return (
    <li
      className={cn(
        'group flex items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-popover/30',
        task.status === 'completed' && 'opacity-60',
      )}
    >
      <Checkbox
        checked={task.status === 'completed'}
        onCheckedChange={() => toggle.mutate(task)}
        disabled={toggle.isPending}
        className="mt-0.5"
      />

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'text-sm text-foreground',
            task.status === 'completed' && 'line-through',
          )}
        >
          {task.title || 'Untitled'}
        </div>

        {task.description && (
          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {task.description}
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {due && (
            <span className={cn('inline-flex items-center gap-1', dueColor)}>
              <Calendar className="h-3 w-3" />
              {due.label}
            </span>
          )}
          {task.recurring && <span className="text-primary">↻ Hằng ngày</span>}
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7', task.priority === 'high' && 'text-yellow-500')}
          onClick={() => toggleImportant.mutate(task)}
          disabled={toggleImportant.isPending}
          title={task.priority === 'high' ? 'Bỏ quan trọng' : 'Đánh dấu quan trọng'}
        >
          <Star
            className={cn('h-4 w-4', task.priority === 'high' && 'fill-current')}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          onClick={handleDelete}
          disabled={deleteTask.isPending}
          title="Xoá task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}