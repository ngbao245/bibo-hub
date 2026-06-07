import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import { API } from '@/lib/config';
import { parseTaskRecords, type Task, type List } from '@/schemas/task';
import { optimisticList } from '@/lib/optimistic';

// ============================================================
// Tasks API hooks — Optimistic UI
// ============================================================
//
// Pattern: UI update ngay khi user action, API save background.
// Nếu API fail → rollback cache, toast error.
// Nếu user đóng tab khi pending → browser warning.
// ============================================================

interface TaskApiResponse {
  tasks: Task[];
  lists: List[];
}

async function fetchTasks(): Promise<TaskApiResponse> {
  const records = await fetchJson<unknown[]>(API.TASKS);
  return parseTaskRecords(records);
}

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
  });
}

// ============================================================
// Mutations — tất cả dùng optimistic update
// ============================================================

export interface TaskInput {
  title: string;
  description?: string;
  dueDate?: string | null;
  priority?: 'normal' | 'high';
  recurring?: boolean;
  parentId?: string | null;
  url1?: string | null;
  url2?: string | null;
  url3?: string | null;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskInput) => {
      const now = new Date().toISOString();
      return fetchJson<Task>(API.TASKS, {
        method: 'POST',
        body: JSON.stringify({
          type: 'task',
          status: 'pending',
          priority: 'normal',
          createdAt: now,
          updatedAt: now,
          ...input,
        }),
      });
    },
    ...optimisticList<TaskApiResponse, TaskInput>(qc, ['tasks'], (old, input) => {
      const tempTask: Task = {
        id: 'temp_' + Date.now(),
        title: input.title,
        type: 'task',
        description: input.description ?? null,
        parentId: input.parentId ?? null,
        status: 'pending',
        priority: input.priority ?? 'normal',
        dueDate: input.dueDate ?? null,
        recurring: input.recurring ?? false,
        url1: null,
        url2: null,
        url3: null,
        completedDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { ...old, tasks: [tempTask, ...old.tasks] };
    }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Task) => {
      return fetchJson<Task>(`${API.TASKS}/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...task, updatedAt: new Date().toISOString() }),
      });
    },
    ...optimisticList<TaskApiResponse, Task>(qc, ['tasks'], (old, task) => ({
      ...old,
      tasks: old.tasks.map((t) => (t.id === task.id ? { ...task, updatedAt: new Date().toISOString() } : t)),
    })),
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Task) => {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const now = new Date().toISOString();
      return fetchJson<Task>(`${API.TASKS}/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...task,
          status: newStatus,
          completedDate: newStatus === 'completed' ? now : null,
          updatedAt: now,
        }),
      });
    },
    ...optimisticList<TaskApiResponse, Task>(qc, ['tasks'], (old, task) => {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const now = new Date().toISOString();
      return {
        ...old,
        tasks: old.tasks.map((t) =>
          t.id === task.id
            ? { ...t, status: newStatus as 'pending' | 'completed', completedDate: newStatus === 'completed' ? now : null, updatedAt: now }
            : t,
        ),
      };
    }),
  });
}

export function useToggleImportant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Task) => {
      const newPriority = task.priority === 'high' ? 'normal' : 'high';
      return fetchJson<Task>(`${API.TASKS}/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...task, priority: newPriority, updatedAt: new Date().toISOString() }),
      });
    },
    ...optimisticList<TaskApiResponse, Task>(qc, ['tasks'], (old, task) => ({
      ...old,
      tasks: old.tasks.map((t) =>
        t.id === task.id
          ? { ...t, priority: (task.priority === 'high' ? 'normal' : 'high') as 'normal' | 'high', updatedAt: new Date().toISOString() }
          : t,
      ),
    })),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson(`${API.TASKS}/${id}`, { method: 'DELETE' });
    },
    ...optimisticList<TaskApiResponse, string>(qc, ['tasks'], (old, id) => ({
      ...old,
      tasks: old.tasks.filter((t) => t.id !== id),
    })),
  });
}

// ============================================================
// Custom lists
// ============================================================

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      const now = new Date().toISOString();
      return fetchJson<List>(API.TASKS, {
        method: 'POST',
        body: JSON.stringify({ type: 'list', title, createdAt: now, updatedAt: now }),
      });
    },
    ...optimisticList<TaskApiResponse, string>(qc, ['tasks'], (old, title) => ({
      ...old,
      lists: [...old.lists, { id: 'temp_' + Date.now(), title, type: 'list' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    })),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (listId: string) => {
      return fetchJson(`${API.TASKS}/${listId}`, { method: 'DELETE' });
    },
    ...optimisticList<TaskApiResponse, string>(qc, ['tasks'], (old, listId) => ({
      ...old,
      lists: old.lists.filter((l) => l.id !== listId),
    })),
  });
}
