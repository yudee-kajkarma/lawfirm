'use client';

import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useUpdateInvoice } from '@/hooks/useInvoices';
import { ApiError } from '@/lib/utils/apiFetch';
import type { SupportedCurrency } from '@/lib/utils/validators/invoice';
import type { Invoice } from '@/types/invoice';

import { InvoiceForm } from './InvoiceForm';
import { isoToDateInput } from './format';

type Props = {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InvoiceEditSheet({ invoice, open, onOpenChange }: Props) {
  const update = useUpdateInvoice();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Edit invoice</SheetTitle>
          <SheetDescription>
            {invoice.invoiceNumber} — only draft invoices can be edited. Send / void to lock.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <InvoiceForm
            mode="edit"
            immutableCoreFields
            defaultValues={{
              title: invoice.title ?? '',
              clientId: invoice.clientId,
              caseId: invoice.caseId,
              businessUnit: invoice.businessUnit,
              currency: invoice.currency as SupportedCurrency,
              issueDate: isoToDateInput(invoice.issueDate),
              dueDate: isoToDateInput(invoice.dueDate),
              lineItems: invoice.lineItems.map((li) => ({
                description: li.description,
                quantity: String(li.quantity),
                unitPrice: String(li.unitPrice),
              })),
              discountPercent: String(invoice.discountPercent),
              taxRate: String(invoice.taxRate),
              notes: invoice.notes ?? '',
              internalNotes: invoice.internalNotes ?? '',
            }}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (input) => {
              try {
                await update.mutateAsync({
                  id: invoice._id,
                  patch: {
                    title: input.title,
                    currency: input.currency,
                    issueDate: input.issueDate,
                    dueDate: input.dueDate,
                    lineItems: input.lineItems,
                    discountPercent: input.discountPercent,
                    taxRate: input.taxRate,
                    notes: input.notes,
                    internalNotes: input.internalNotes,
                  },
                });
                toast.success('Invoice updated');
                onOpenChange(false);
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to update invoice';
                toast.error(msg);
              }
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
