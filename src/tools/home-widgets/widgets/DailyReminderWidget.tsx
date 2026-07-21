// ============================================================
// Daily Reminder Widget — recurring tasks pending today
// ============================================================

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { useTasks, useToggleTask } from '@/api/tasks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';

import type { Task } from '@/schemas/task';

export default function DailyReminderWidget() {
  const navigate = useNavigate();
  const tasksQuery = useTasks();

  const dailyPending = useMemo(
    () =>
      tasksQuery.data?.tasks.filter(
        (t) => t.recurring && t.status === 'pending',
      ) ?? [],
    [tasksQuery.data],
  );

  if (tasksQuery.isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (dailyPending.length === 0) {
    return (
      <div className="py-3 text-center text-sm text-muted-foreground">
        Tất cả recurring tasks đã xong hôm nay.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {dailyPending.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/tasks')}
        className="w-full gap-1.5 text-xs text-muted-foreground"
      >
        Xem tất cả Tasks <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const toggle = useToggleTask();

  function handleToggle() {
    toggle.mutate(task, {
      onSuccess: () => toast.success('Done', { description: task.title }),
    });
  }

  return (
    <li className="flex items-start gap-3 rounded border border-border bg-card px-3 py-2 transition-colors hover:border-primary">
      <Checkbox
        checked={false}
        onCheckedChange={handleToggle}
        disabled={toggle.isPending}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground">{task.title || 'Untitled'}</div>
        {task.description && (
          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {task.description}
          </div>
        )}
      </div>
    </li>
  );
}