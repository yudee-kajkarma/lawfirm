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
import { useDeleteInvoice } from '@/hooks/useInvoices';
import { ApiError } from '@/lib/utils/apiFetch';
import { cn } from '@/lib/utils';
import type { Invoice } from '@/types/invoice';

type Props = {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function InvoiceDeleteAlert({ invoice, open, onOpenChange, onDeleted }: Props) {
  const del = useDeleteInvoice();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            {invoice.invoiceNumber} will be soft-deleted. Audit log is preserved. Only drafts and
            voided invoices can be removed.
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
                await del.mutateAsync(invoice._id);
                toast.success('Invoice deleted');
                onOpenChange(false);
                onDeleted?.();
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to delete invoice';
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
