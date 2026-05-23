'use client';

import { Ban, CheckCheck, Send } from 'lucide-react';
import { useState } from 'react';
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
import { Button, buttonVariants } from '@/components/ui/button';
import {
  useMarkInvoicePaid,
  useSendInvoice,
  useVoidInvoice,
} from '@/hooks/useInvoices';
import { ApiError } from '@/lib/utils/apiFetch';
import { cn } from '@/lib/utils';
import type { Invoice } from '@/types/invoice';

type ActionKey = 'send' | 'mark-paid' | 'void';

type Props = { invoice: Invoice };

export function InvoiceActions({ invoice }: Props) {
  const [confirming, setConfirming] = useState<ActionKey | null>(null);

  const send = useSendInvoice();
  const markPaid = useMarkInvoicePaid();
  const voidIt = useVoidInvoice();

  const status = invoice.persistedStatus;
  const canSend = status === 'draft';
  const canMarkPaid = status === 'sent';
  const canVoid = status !== 'paid' && status !== 'void';

  async function run(action: ActionKey) {
    try {
      if (action === 'send') {
        await send.mutateAsync(invoice._id);
        toast.success(`${invoice.invoiceNumber} sent`);
      } else if (action === 'mark-paid') {
        await markPaid.mutateAsync(invoice._id);
        toast.success(`${invoice.invoiceNumber} marked as paid`);
      } else {
        await voidIt.mutateAsync(invoice._id);
        toast.success(`${invoice.invoiceNumber} voided`);
      }
      setConfirming(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Action failed';
      toast.error(msg);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canSend && (
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setConfirming('send')}
            disabled={send.isPending}
          >
            <Send className="size-3.5" />
            Mark sent
          </Button>
        )}
        {canMarkPaid && (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
            onClick={() => setConfirming('mark-paid')}
            disabled={markPaid.isPending}
          >
            <CheckCheck className="size-3.5" />
            Mark paid
          </Button>
        )}
        {canVoid && (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-destructive hover:bg-destructive/5"
            onClick={() => setConfirming('void')}
            disabled={voidIt.isPending}
          >
            <Ban className="size-3.5" />
            Void
          </Button>
        )}
      </div>

      <AlertDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === 'send' && 'Mark this invoice as sent?'}
              {confirming === 'mark-paid' && 'Mark this invoice as paid?'}
              {confirming === 'void' && 'Void this invoice?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === 'send' &&
                "Once sent, the invoice is locked from edits. Email delivery itself is wired up in a later phase — for now, download the PDF and share it manually."}
              {confirming === 'mark-paid' &&
                'The paid date will be stamped to now. You can void if marked by mistake.'}
              {confirming === 'void' &&
                "Voided invoices stay in history but no longer count toward totals. Can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                buttonVariants({
                  variant: confirming === 'void' ? 'destructive' : 'default',
                }),
              )}
              onClick={(e) => {
                e.preventDefault();
                if (confirming) void run(confirming);
              }}
            >
              {confirming === 'send' && 'Mark sent'}
              {confirming === 'mark-paid' && 'Mark paid'}
              {confirming === 'void' && 'Void'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
