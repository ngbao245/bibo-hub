import { useEffect, useMemo } from 'react';
import { Sun, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useTasks, useToggleTask } from '@/api/tasks';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useModalStore } from '@/stores/modalStore';

import ToolModal from '@/components/ToolModal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';

import type { Task } from '@/schemas/task';

// ============================================================
// DailyReminder Modal
// ============================================================
//
// Tự động mở khi user vào app nếu:
// - Có recurring task pending (chưa làm hôm nay)
// - Cooldown 2h (đã hiển thị trong 2 tiếng qua thì không hiện lại)
//
// User check task → toggle complete. Khi hết task → tự đóng.
// ============================================================

const COOLDOWN_KEY = 'daily_reminder_last_shown';
const COOLDOWN_HOURS = 2;

export default function DailyReminder() {
  const open = useModalStore((s) => s.open);
  const tasksQuery = useTasks();

  // localStorage timestamp lần hiển thị gần nhất
  const [lastShown, setLastShown] = useLocalStorage<string | null>(COOLDOWN_KEY, null);

  // 📚 useEffect chạy 1 lần khi data tasks load xong:
  // - Check có recurring task pending không
  // - Check cooldown 2h
  // - Nếu cả 2 đều OK → mở modal + cập nhật lastShown
  useEffect(() => {
    if (!tasksQuery.data) return;

    // Cooldown check
    if (lastShown) {
      const diff = (Date.now() - new Date(lastShown).getTime()) / 3_600_000;
      if (diff < COOLDOWN_HOURS) return;
    }

    const dailyPending = tasksQuery.data.tasks.filter(
      (t) => t.recurring && t.status === 'pending',
    );
    if (dailyPending.length === 0) return;

    setLastShown(new Date().toISOString());
    open('dailyReminder');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksQuery.data]);

  return (
    <ToolModal
      id="dailyReminder"
      title="Nhắc nhở hôm nay"
      description="Việc cần làm mỗi ngày"
      className="max-w-md"
    >
      <DailyReminderContent />
    </ToolModal>
  );
}

function DailyReminderContent() {
  const navigate = useNavigate();
  const close = useModalStore((s) => s.close);
  const tasksQuery = useTasks();

  const dailyPending = useMemo(
    () =>
      tasksQuery.data?.tasks.filter(
        (t) => t.recurring && t.status === 'pending',
      ) ?? [],
    [tasksQuery.data],
  );

  // 📚 Auto-close khi không còn task pending nào.
  // deps = [length] để chỉ chạy khi count đổi (không phải mỗi render).
  useEffect(() => {
    if (tasksQuery.data && dailyPending.length === 0) {
      const timer = setTimeout(() => close(), 600);
      return () => clearTimeout(timer);
    }
  }, [dailyPending.length, tasksQuery.data, close]);

  if (tasksQuery.isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sun className="h-4 w-4 text-primary" />
        <span>{dailyPending.length} việc lặp hằng ngày chưa hoàn thành</span>
      </div>

      {dailyPending.length === 0 ? (
        <div className="border border-dashed border-border bg-card py-6 text-center text-sm text-muted-foreground">
          Tất cả đã xong!
        </div>
      ) : (
        <ul className="space-y-1.5">
          {dailyPending.map((task) => (
            <DailyTaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}

      <div className="flex gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          onClick={() => {
            close();
            navigate('/tasks');
          }}
          className="flex-1 gap-1.5"
        >
          Xem tất cả Tasks
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DailyTaskRow({ task }: { task: Task }) {
  const toggle = useToggleTask();

  function handleToggle() {
    toggle.mutate(task, {
      onSuccess: () => toast.success('Hoàn thành', { description: task.title }),
    });
  }

  return (
    <li className="flex items-start gap-3 border border-border bg-card px-3 py-2 transition-colors hover:border-primary">
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
