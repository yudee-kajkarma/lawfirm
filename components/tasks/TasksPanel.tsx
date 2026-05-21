'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasksList, useUpdateTask } from '@/hooks/useTasks';
import { ApiError } from '@/lib/utils/apiFetch';
import { cn } from '@/lib/utils';
import type { PolyRelatedType } from '@/lib/constants/enums';
import type { Task } from '@/types/task';

import { TaskCreateDialog } from './TaskCreateDialog';
import { TaskDeleteAlert } from './TaskDeleteAlert';
import { TaskEditSheet } from './TaskEditSheet';
import { TaskPriorityDot } from './TaskBadges';

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

type Props = {
  relatedToType: PolyRelatedType;
  relatedToId: string;
  businessUnit: string;
};

export function TasksPanel({ relatedToType, relatedToId, businessUnit }: Props) {
  const list = useTasksList({
    relatedToType,
    relatedToId,
    limit: 50,
  });
  const update = useUpdateTask();

  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  async function toggle(task: Task) {
    try {
      await update.mutateAsync({
        id: task._id,
        patch: { status: task.status === 'done' ? 'todo' : 'done' },
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to update task';
      toast.error(msg);
    }
  }

  const items = list.data?.items ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>
              Tasks
              {items.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                  {items.filter((t) => t.status === 'done').length} / {items.length}
                </span>
              )}
            </span>
            <TaskCreateDialog
              relatedTo={{ type: relatedToType, id: relatedToId }}
              lockedBusinessUnit={businessUnit}
              trigger={
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="size-3.5" />
                  Add task
                </Button>
              }
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks yet — track follow-ups, deadlines, or todos here.
            </p>
          ) : (
            <ul className="-mx-2 space-y-0.5">
              {items.map((task) => {
                const overdue = isOverdue(task);
                const due = formatDue(task.dueDate);
                return (
                  <li
                    key={task._id}
                    className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={task.status === 'done'}
                      onChange={() => toggle(task)}
                      className="size-4 flex-shrink-0 rounded border-border accent-primary"
                      aria-label={`Mark "${task.title}" ${task.status === 'done' ? 'incomplete' : 'done'}`}
                    />
                    <TaskPriorityDot priority={task.priority} />
                    <span
                      className={cn(
                        'flex-1 truncate text-sm',
                        task.status === 'done' && 'text-muted-foreground line-through',
                      )}
                    >
                      {task.title}
                    </span>
                    {due && (
                      <span
                        className={cn(
                          'text-xs tabular-nums',
                          overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {due}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditing(task)}
                        aria-label="Edit task"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setDeleting(task)}
                        aria-label="Delete task"
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing && (
        <TaskEditSheet
          task={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      {deleting && (
        <TaskDeleteAlert
          task={deleting}
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
        />
      )}
    </>
  );
}
