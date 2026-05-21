'use client';

import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useUpdateTask } from '@/hooks/useTasks';
import { ApiError } from '@/lib/utils/apiFetch';
import type { Task } from '@/types/task';

import { TaskForm } from './TaskForm';

type Props = {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function TaskEditSheet({ task, open, onOpenChange }: Props) {
  const update = useUpdateTask();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit task</SheetTitle>
          <SheetDescription>Updating &ldquo;{task.title}&rdquo;.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <TaskForm
            submitLabel="Save changes"
            isSubmitting={update.isPending}
            // Editing keeps the existing relatedTo invisible — passing it in
            // would re-write it every save. The PATCH only sends form fields.
            lockedBusinessUnit={task.businessUnit}
            defaultValues={{
              title: task.title,
              description: task.description ?? '',
              status: task.status,
              priority: task.priority,
              businessUnit: task.businessUnit,
              dueDate: isoToDateInput(task.dueDate),
            }}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (data) => {
              try {
                // Strip relatedTo from the patch — we don't change attachments on edit.
                const { relatedTo: _ignored, ...patch } = data;
                void _ignored;
                await update.mutateAsync({ id: task._id, patch });
                toast.success('Task updated');
                onOpenChange(false);
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to update task';
                toast.error(msg);
              }
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
