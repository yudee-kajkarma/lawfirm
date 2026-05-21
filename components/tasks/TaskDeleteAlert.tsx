'use client';

import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { useDeleteTask } from '@/hooks/useTasks';
import { ApiError } from '@/lib/utils/apiFetch';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/task';

type Props = {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function TaskDeleteAlert({ task, open, onOpenChange, onDeleted }: Props) {
  const del = useDeleteTask();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete task?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{task.title}&rdquo; will be soft-deleted. Audit log is preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            disabled={del.isPending}
            onClick={async (e) => {
              e.preventDefault();
              try {
                await del.mutateAsync(task._id);
                toast.success('Task deleted');
                onOpenChange(false);
                onDeleted?.();
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to delete task';
                toast.error(msg);
              }
            }}
          >
            {del.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
