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
import { useCreateSmartList } from '@/hooks/useSmartLists';
import { ApiError } from '@/lib/utils/apiFetch';
import type { SmartListEntity } from '@/lib/utils/smartListFields';

import { SmartListForm } from './SmartListForm';

type Props = {
  trigger: React.ReactNode;
  /** Pre-select the entity dropdown — used by the picker's "+ New" button. */
  defaultEntity?: SmartListEntity;
};

export function SmartListCreateDialog({ trigger, defaultEntity }: Props) {
  const [open, setOpen] = useState(false);
  const create = useCreateSmartList();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New smart list</DialogTitle>
          <DialogDescription>
            A saved query that the CRM re-runs every time you open it.
          </DialogDescription>
        </DialogHeader>
        <SmartListForm
          mode="create"
          isSubmitting={create.isPending}
          defaultValues={{ entity: defaultEntity }}
          onCancel={() => setOpen(false)}
          onSubmit={async (input) => {
            try {
              const sl = await create.mutateAsync(input);
              toast.success(`"${sl.name}" created`);
              setOpen(false);
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Failed to create smart list';
              toast.error(msg);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
