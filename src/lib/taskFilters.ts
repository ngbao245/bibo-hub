import type { Task } from '@/schemas/task';

// ============================================================
// Task filtering & sorting
// ============================================================
//
// Built-in lists v1: 'all', 'today', 'important', 'completed'
// Custom list: id của 1 record type='list'
// ============================================================

export type TaskListFilter = 'all' | 'today' | 'important' | 'completed' | string;

/** Check id có phải custom list không (không phải 4 built-in) */
export function isCustomListId(id: string): boolean {
  return !['all', 'today', 'important', 'completed'].includes(id);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < startOfDay(new Date());
}

function isToday(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return startOfDay(new Date(dueDate)).getTime() === startOfDay(new Date()).getTime();
}

/** Lọc tasks theo filter (built-in hoặc custom list id) */
export function filterTasks(tasks: Task[], filter: TaskListFilter): Task[] {
  switch (filter) {
    case 'all':
      return tasks;

    case 'today':
      // Today: pending + (recurring OR due today OR overdue)
      return tasks.filter(
        (t) =>
          t.status !== 'completed' &&
          (t.recurring || isToday(t.dueDate) || isOverdue(t.dueDate)),
      );

    case 'important':
      return tasks.filter((t) => t.priority === 'high' && t.status !== 'completed');

    case 'completed':
      return tasks.filter((t) => t.status === 'completed');

    default:
      // Custom list: filter theo parentId
      return tasks.filter((t) => t.parentId === filter);
  }
}

/** Sort tasks: pending lên trên, important trước, due gần hơn trước, mới hơn trước */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // 1. completed xuống dưới
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;

    // 2. important lên trên
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;

    // 3. có dueDate lên trên không có
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }

    // 4. mới tạo trước
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

/** Đếm số tasks theo từng filter (cho hiển thị badge) */
export function countTasks(tasks: Task[]) {
  return {
    all: tasks.length,
    today: filterTasks(tasks, 'today').length,
    important: filterTasks(tasks, 'important').length,
    completed: filterTasks(tasks, 'completed').length,
  };
}
