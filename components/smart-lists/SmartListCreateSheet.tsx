'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useCreateSmartList } from '@/hooks/useSmartLists';
import { ApiError } from '@/lib/utils/apiFetch';
import type { SmartListEntity } from '@/lib/utils/smartListFields';

import { SmartListForm } from './SmartListForm';

type Props = {
  trigger: React.ReactNode;
  /** Pre-select the entity dropdown — used by the picker's "+ New" button. */
  defaultEntity?: SmartListEntity;
};

export function SmartListCreateSheet({ trigger, defaultEntity }: Props) {
  const [open, setOpen] = useState(false);
  const create = useCreateSmartList();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>New smart list</SheetTitle>
          <SheetDescription>
            A saved query that the CRM re-runs every time you open it.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
