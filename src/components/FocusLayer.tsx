
import { useState } from 'react';
import {
  CheckSquare,
  StickyNote,
  ChevronUp,
  Plus,
  AlarmClock,
  AlertCircle,
  Repeat,
  PartyPopper,
  X,
} from 'lucide-react';

import { useTasks, useToggleTask, useCreateTask, useDeleteTask } from '@/api/tasks';
import { useNotes, useCreateNote } from '@/api/notes';
import { getFocusTasks, getFocusNotes, formatDueDate } from '@/lib/focus';
import { cn } from '@/lib/cn';
import type { Task } from '@/schemas/task';
import type { Note } from '@/schemas/note';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';

// ============================================================
// FocusLayer - section trên cùng HubPro
// ============================================================
//
// Lấy data từ MockAPI thật.
// Algorithm focus tasks: ưu tiên overdue → today → tomorrow → soon.
// Notes: 3 note update gần nhất (type='note').
// ============================================================

interface FocusLayerProps {
  onHide: () => void;
}

export default function FocusLayer({ onHide }: FocusLayerProps) {
  const tasksQuery = useTasks();
  const notesQuery = useNotes();

  const focusTasks = tasksQuery.data ? getFocusTasks(tasksQuery.data.tasks, 5) : [];

  const focusNotes = notesQuery.data ? getFocusNotes(notesQuery.data, 3) : [];

  const isLoading = tasksQuery.isLoading || notesQuery.isLoading;
  const isEmpty = !isLoading && focusTasks.length === 0 && focusNotes.length === 0;

  return (
    <section className="border-b border-border bg-card">
      <div className="px-[clamp(12px,4vw,8rem)] pb-4 pt-3">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-foreground">Tập trung hôm nay</h2>
            {!isLoading && (
              <span className="text-xs text-muted-foreground">
                {focusTasks.length} công việc · {focusNotes.length} ghi chú
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onHide} className="h-7 gap-1 px-2 text-xs">
            <ChevronUp className="h-3.5 w-3.5" />
            Ẩn
          </Button>
        </div>

        <QuickAdd />

        {isLoading && <SkeletonGrid />}

        {!isLoading && !isEmpty && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Column
              icon={<CheckSquare className="h-4 w-4" />}
              label="Công việc cần làm"
              count={focusTasks.length}
            >
              {focusTasks.length === 0 ? (
                <Empty text="Không có công việc nào cần focus." />
              ) : (
                focusTasks.map((task) => <TaskRow key={task.id} task={task} />)
              )}
            </Column>

            <Column
              icon={<StickyNote className="h-4 w-4" />}
              label="Ghi chú gần đây"
              count={focusNotes.length}
            >
              {focusNotes.length === 0 ? (
                <Empty text="Chưa có ghi chú nào." />
              ) : (
                focusNotes.map((note) => <NoteRow key={note.id} note={note} />)
              )}
            </Column>
          </div>
        )}

        {isEmpty && (
          <div className="mt-3 flex items-center justify-center gap-2 border border-dashed border-border bg-background/50 py-6 text-sm text-muted-foreground">
            <PartyPopper className="h-4 w-4 text-primary" />
            Tuyệt vời, hôm nay không có việc gì cần focus!
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// Quick Add - input + tabs Task/Note
// ============================================================
function QuickAdd() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'task' | 'note'>('task');
  const createTask = useCreateTask();
  const createNote = useCreateNote();

  const isPending = createTask.isPending || createNote.isPending;

  const submit = () => {
    const value = text.trim();
    if (!value) return;

    if (mode === 'task') {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      createTask.mutate(
        { title: value, dueDate: today.toISOString() },
        {
          onSuccess: () => {
            setText('');
            toast.success('Đã thêm công việc', { description: value });
          },
          onError: () => toast.error('Không thêm được công việc'),
        },
      );
    } else {
      createNote.mutate(
        { title: value, type: 'note' },
        {
          onSuccess: () => {
            setText('');
            toast.success('Đã thêm ghi chú', { description: value });
          },
          onError: () => toast.error('Không thêm được ghi chú'),
        },
      );
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'task' | 'note')} className="shrink-0">
        <TabsList className="h-9">
          <TabsTrigger value="task" className="gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" />
            Công việc
          </TabsTrigger>
          <TabsTrigger value="note" className="gap-1.5">
            <StickyNote className="h-3.5 w-3.5" />
            Ghi chú
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-1 gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={
            mode === 'task'
              ? 'Bạn cần làm gì hôm nay?'
              : 'Ghi chú nhanh...'
          }
          disabled={isPending}
          className="flex-1"
        />
        <Button onClick={submit} disabled={isPending || !text.trim()} size="default" className="shrink-0">
          <Plus className="h-4 w-4" />
          Thêm
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Column({
  icon,
  label,
  count,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <span>{label}</span>
        <span className="text-primary">({count})</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const toggle = useToggleTask();
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

  const handleToggle = () => {
    toggle.mutate(task, {
      onSuccess: () => {
        if (task.status !== 'completed') {
          toast.success('Đã hoàn thành', { description: task.title });
        }
      },
    });
  };

  const handleDelete = () => {
    deleteTask.mutate(task.id, {
      onSuccess: () => toast.success('Đã xoá', { description: task.title }),
    });
  };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 border border-border bg-background px-3 py-2 transition-colors hover:border-primary',
        task.status === 'completed' && 'opacity-60',
      )}
    >
      <Checkbox
        checked={task.status === 'completed'}
        onCheckedChange={handleToggle}
        disabled={toggle.isPending}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate text-sm text-foreground',
            task.status === 'completed' && 'line-through',
          )}
        >
          {task.title || 'Không có tiêu đề'}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {due && (
            <span className={cn('inline-flex items-center gap-1', dueColor)}>
              {due.tone === 'overdue' ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <AlarmClock className="h-3 w-3" />
              )}
              {due.label}
            </span>
          )}
          {task.priority === 'high' && (
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" />
              Quan trọng
            </span>
          )}
          {task.recurring && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Repeat className="h-3 w-3" />
              Hằng ngày
            </span>
          )}
        </div>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleteTask.isPending}
        className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        title="Xoá task"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function NoteRow({ note }: { note: Note }) {
  // Strip HTML tags để hiển thị preview text
  const preview = note.content.replace(/<[^>]+>/g, '').slice(0, 100);

  return (
    <div className="border border-border bg-background px-3 py-2 transition-colors hover:border-primary">
      <div className="truncate text-sm font-medium text-foreground">
        {note.title || 'Không có tiêu đề'}
      </div>
      {preview && (
        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{preview}</div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {[1, 2].map((col) => (
        <div key={col} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-border bg-background/50 px-3 py-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}