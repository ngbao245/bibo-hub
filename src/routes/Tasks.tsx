import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Sparkles, Keyboard } from 'lucide-react';

import { useTasks, useCreateList, useDeleteList } from '@/api/tasks';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

import TaskSidebar from '@/components/TaskSidebar';
import TaskList from '@/components/TaskList';
import { isCustomListId, type TaskListFilter } from '@/lib/taskFilters';

// ============================================================
// Tasks Page - layout 3 cột
//
// ┌─────────┬──────────────┬──────────────────────────────┐
// │  Hub    │  TaskSidebar │  TaskList                    │
// │  Nav    │  (Today,     │  (search, quick add,         │
// │         │   Important, │   list của filter hiện tại)  │
// │         │   Custom...) │                              │
// └─────────┴──────────────┴──────────────────────────────┘
// ============================================================

const BUILTIN_LABELS: Record<string, string> = {
  all: 'Tất cả',
  today: 'Hôm nay',
  important: 'Quan trọng',
  completed: 'Hoàn thành',
};

export default function Tasks() {
  const tasksQuery = useTasks();
  const createList = useCreateList();
  const deleteList = useDeleteList();

  // Lưu filter đang chọn để vào lại trang giữ chỗ
  const [filter, setFilter] = useLocalStorage<TaskListFilter>('tasks_filter', 'today');
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);

  const tasks = tasksQuery.data?.tasks ?? [];
  const lists = tasksQuery.data?.lists ?? [];

  // Tính title hiển thị: built-in → label tiếng Việt; custom list → tên list
  let title: string;
  if (BUILTIN_LABELS[filter]) {
    title = BUILTIN_LABELS[filter];
  } else if (isCustomListId(filter)) {
    const list = lists.find((l) => l.id === filter);
    title = list?.title || 'Danh sách';
  } else {
    title = 'Tasks';
  }

  function handleCreateList(title: string) {
    createList.mutate(title, {
      onSuccess: (newList) => {
        setFilter(newList.id);
        toast.success(`Đã tạo danh sách "${title}"`);
      },
      onError: () => toast.error('Không tạo được danh sách'),
    });
  }

  function handleDeleteList(id: string) {
    deleteList.mutate(id, {
      onSuccess: () => {
        if (filter === id) setFilter('today');
        toast.success('Đã xoá danh sách');
      },
      onError: () => toast.error('Không xoá được danh sách'),
    });
  }

  function handleSelect(f: TaskListFilter) {
    setFilter(f);
    setSidebarOpenMobile(false);
  }

  return (
    <div className="flex h-full">
      {/* Hub nav sidebar */}
      <aside className="flex w-[60px] shrink-0 flex-col border-r border-border bg-card max-md:hidden">
        <Link
          to="/"
          className="flex h-12 items-center justify-center border-b border-border text-muted-foreground transition-colors hover:bg-popover hover:text-foreground"
          title="Hub"
        >
          <img src="/apps.png" alt="Hub" className="h-5 w-5 opacity-70" />
        </Link>
        <Link
          to="/notes"
          className="flex h-12 items-center justify-center border-b border-border text-muted-foreground transition-colors hover:bg-popover hover:text-foreground"
        >
          <span className="text-xs font-medium">Notes</span>
        </Link>
        <Link
          to="/tasks"
          className="flex h-12 items-center justify-center border-b border-border bg-popover text-primary"
        >
          <span className="text-xs font-medium">Tasks</span>
        </Link>
      </aside>

      {/* Task filter sidebar */}
      <aside
        className={cn(
          'flex w-[260px] shrink-0 flex-col border-r border-border bg-card',
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[1000] max-md:transition-transform',
          sidebarOpenMobile ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
        )}
      >
        <TaskSidebar
          tasks={tasks}
          lists={lists}
          selected={filter}
          onSelect={handleSelect}
          onCreateList={handleCreateList}
          onDeleteList={handleDeleteList}
        />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpenMobile && (
        <div
          className="fixed inset-0 z-[999] bg-black/50 md:hidden"
          onClick={() => setSidebarOpenMobile(false)}
        />
      )}

      {/* Main content */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="hidden items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 max-md:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpenMobile((v) => !v)}
            className="h-8 w-8"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h2 className="truncate text-sm font-medium">{title}</h2>
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/">
              <img src="/apps.png" alt="Hub" className="h-4 w-4 opacity-70" />
            </Link>
          </Button>
        </header>

        {/* Desktop top corner */}
        <div className="absolute right-4 top-3 z-10 flex gap-2 max-md:hidden">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/pro">
              <Sparkles className="h-3.5 w-3.5" />
              Hub Pro
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => alert('Shortcuts modal — sẽ migrate sau')}
            className="h-9 w-9"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>

        <TaskList
          tasks={tasks}
          isLoading={tasksQuery.isLoading}
          filter={filter}
          title={title}
        />
      </main>
    </div>
  );
}
