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
import { useDeleteSmartList } from '@/hooks/useSmartLists';
import { ApiError } from '@/lib/utils/apiFetch';
import { cn } from '@/lib/utils';
import type { SmartList } from '@/types/smartList';

type Props = {
  smartList: SmartList;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SmartListDeleteAlert({ smartList, open, onOpenChange }: Props) {
  const del = useDeleteSmartList();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete smart list?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{smartList.name}&rdquo; will be soft-deleted. The underlying {smartList.entity} records
            are not affected.
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
                await del.mutateAsync(smartList._id);
                toast.success('Smart list deleted');
                onOpenChange(false);
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to delete smart list';
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
