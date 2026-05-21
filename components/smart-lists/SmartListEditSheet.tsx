'use client';

import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useUpdateSmartList } from '@/hooks/useSmartLists';
import { ApiError } from '@/lib/utils/apiFetch';
import type { SmartList } from '@/types/smartList';

import { SmartListForm } from './SmartListForm';

type Props = {
  smartList: SmartList;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SmartListEditSheet({ smartList, open, onOpenChange }: Props) {
  const update = useUpdateSmartList();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Edit smart list</SheetTitle>
          <SheetDescription>{smartList.name}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <SmartListForm
            mode="edit"
            isSubmitting={update.isPending}
            defaultValues={{
              name: smartList.name,
              description: smartList.description,
              entity: smartList.entity,
              businessUnit: smartList.businessUnit,
              filterTree: smartList.filterTree,
            }}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (patch) => {
              try {
                await update.mutateAsync({ id: smartList._id, patch });
                toast.success('Smart list updated');
                onOpenChange(false);
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to update smart list';
                toast.error(msg);
              }
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
