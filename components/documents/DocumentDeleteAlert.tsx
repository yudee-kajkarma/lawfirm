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
import { useDeleteDocument } from '@/hooks/useDocuments';
import { ApiError } from '@/lib/utils/apiFetch';
import { cn } from '@/lib/utils';
import type { DocumentRecord } from '@/types/document';

type Props = {
  doc: DocumentRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DocumentDeleteAlert({ doc, open, onOpenChange }: Props) {
  const del = useDeleteDocument();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete document?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{doc.filename}&rdquo; will be soft-deleted from the CRM. The file itself stays
            in S3 until a lifecycle policy cleans it up — an admin can restore the metadata
            without re-uploading.
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
                await del.mutateAsync(doc._id);
                toast.success('Document deleted');
                onOpenChange(false);
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to delete document';
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
