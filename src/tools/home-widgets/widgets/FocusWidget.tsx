// ============================================================
// Focus Widget — "Tập trung hôm nay" as a widget
// ============================================================
// Wraps the existing FocusLayer logic without the outer section chrome
// (header/hide handled by WidgetWrapper).
// ============================================================

import { useState } from 'react';
import {
  CheckSquare,
  StickyNote,
  Plus,
  AlertCircle,
  Repeat,
  PartyPopper,
} from 'lucide-react';

import { useTasks, useToggleTask, useCreateTask } from '@/api/tasks';
import { useNotes, useCreateNote } from '@/api/notes';
import { getFocusTasks, getFocusNotes, formatDueDate } from '@/lib/focus';
import { cn } from '@/lib/cn';
import type { Task } from '@/schemas/task';
import type { Note } from '@/schemas/note';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { LoadingState } from '@/components/shared';

export default function FocusWidget() {
  const tasksQuery = useTasks();
  const notesQuery = useNotes();

  const focusTasks = tasksQuery.data ? getFocusTasks(tasksQuery.data.tasks, 5) : [];
  const focusNotes = notesQuery.data ? getFocusNotes(notesQuery.data, 3) : [];

  const isLoading = tasksQuery.isLoading || notesQuery.isLoading;
  const isEmpty = !isLoading && focusTasks.length === 0 && focusNotes.length === 0;

  return (
    <div>
      <QuickAdd />

      {isLoading && (
        <div className="mt-3">
          <LoadingState variant="skeleton" count={3} layout="list" itemClassName="h-10" />
        </div>
      )}

      {!isLoading && !isEmpty && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Column
            icon={<CheckSquare className="h-4 w-4" />}
            label="Cong viec"
            count={focusTasks.length}
          >
            {focusTasks.map((task) => <TaskRow key={task.id} task={task} />)}
          </Column>

          <Column
            icon={<StickyNote className="h-4 w-4" />}
            label="Ghi chu"
            count={focusNotes.length}
          >
            {focusNotes.map((note) => <NoteRow key={note.id} note={note} />)}
          </Column>
        </div>
      )}

      {isEmpty && (
        <div className="mt-3 flex items-center justify-center gap-2 border border-dashed border-border bg-background/50 py-4 text-sm text-muted-foreground">
          <PartyPopper className="h-4 w-4 text-primary" />
          Hom nay khong co viec gi can focus!
        </div>
      )}
    </div>
  );
}

// ── QuickAdd ──

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
          onSuccess: () => { setText(''); toast.success('Added task'); },
          onError: () => toast.error('Failed'),
        },
      );
    } else {
      createNote.mutate(
        { title: value, type: 'note' },
        {
          onSuccess: () => { setText(''); toast.success('Added note'); },
          onError: () => toast.error('Failed'),
        },
      );
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'task' | 'note')} className="shrink-0">
        <TabsList className="h-8">
          <TabsTrigger value="task" className="gap-1 text-xs">
            <CheckSquare className="h-3 w-3" /> Task
          </TabsTrigger>
          <TabsTrigger value="note" className="gap-1 text-xs">
            <StickyNote className="h-3 w-3" /> Note
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-1 gap-1.5">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder={mode === 'task' ? 'Them cong viec...' : 'Them ghi chu...'}
          className="h-8 text-sm"
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={submit} disabled={!text.trim() || isPending}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Column ──

function Column({ icon, label, count, children }: { icon: React.ReactNode; label: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
        <span className="ml-auto text-[10px]">{count}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// ── TaskRow ──

function TaskRow({ task }: { task: Task }) {
  const toggle = useToggleTask();

  const due = task.dueDate ? formatDueDate(task.dueDate) : null;
  const isOverdue = due?.tone === 'overdue';

  return (
    <div className="flex items-start gap-2 rounded border border-border bg-background px-2 py-1.5 text-sm">
      <Checkbox
        checked={false}
        onCheckedChange={() => toggle.mutate(task, { onSuccess: () => toast.success('Done') })}
        disabled={toggle.isPending}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <span className="line-clamp-1">{task.title}</span>
        {due && (
          <span className={cn('text-[10px]', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
            {isOverdue && <AlertCircle className="mr-0.5 inline h-2.5 w-2.5" />}
            {task.recurring && <Repeat className="mr-0.5 inline h-2.5 w-2.5" />}
            {due.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ── NoteRow ──

function NoteRow({ note }: { note: Note }) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5 text-sm">
      <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="line-clamp-1">{note.title || 'Untitled'}</span>
    </div>
  );
}