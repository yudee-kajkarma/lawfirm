'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCreateTask } from '@/hooks/useTasks';
import { ApiError } from '@/lib/utils/apiFetch';
import type { TaskRelatedTo } from '@/types/task';

import { TaskForm } from './TaskForm';

type Props = {
  trigger: React.ReactNode;
  relatedTo?: TaskRelatedTo;
  lockedBusinessUnit?: string;
};

export function TaskCreateDialog({ trigger, relatedTo, lockedBusinessUnit }: Props) {
  const [open, setOpen] = useState(false);
  const create = useCreateTask();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            {relatedTo
              ? `Linked to this ${relatedTo.type}.`
              : 'Standalone task — link to a lead, case, or contact from those pages instead.'}
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          submitLabel="Create task"
          isSubmitting={create.isPending}
          relatedTo={relatedTo}
          lockedBusinessUnit={lockedBusinessUnit}
          onCancel={() => setOpen(false)}
          onSubmit={async (data) => {
            try {
              await create.mutateAsync(data);
              toast.success('Task created');
              setOpen(false);
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Failed to create task';
              toast.error(msg);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
