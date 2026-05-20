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
import { useDeleteContact } from '@/hooks/useContacts';
import { ApiError } from '@/lib/utils/apiFetch';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/contact';

type Props = {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function ContactDeleteAlert({ contact, open, onOpenChange, onDeleted }: Props) {
  const del = useDeleteContact();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete contact?</AlertDialogTitle>
          <AlertDialogDescription>
            {contact.firstName} {contact.lastName} will be soft-deleted. The record stays in the
            database (audit log preserved) and can be restored by an administrator.
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
                await del.mutateAsync(contact._id);
                toast.success('Contact deleted');
                onOpenChange(false);
                onDeleted?.();
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to delete contact';
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
