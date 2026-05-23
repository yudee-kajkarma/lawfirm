'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { Button } from '@/components/ui/button';
import { useCreateInvoice } from '@/hooks/useInvoices';
import { ApiError } from '@/lib/utils/apiFetch';

type Props = {
  initialClientId?: string;
  initialCaseId?: string;
  initialBusinessUnit?: string;
  initialTitle?: string;
};

export function NewInvoiceClient({
  initialClientId,
  initialCaseId,
  initialBusinessUnit,
  initialTitle,
}: Props) {
  const router = useRouter();
  const create = useCreateInvoice();

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1 text-muted-foreground"
          onClick={() => router.push('/invoices')}
        >
          <ArrowLeft className="size-3.5" />
          All invoices
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build a draft invoice. Save it now; review and send (or void) from its detail page.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <InvoiceForm
          mode="create"
          defaultValues={{
            title: initialTitle,
            clientId: initialClientId,
            caseId: initialCaseId,
            businessUnit: initialBusinessUnit,
          }}
          isSubmitting={create.isPending}
          onCancel={() => router.push('/invoices')}
          onSubmit={async (input) => {
            try {
              const inv = await create.mutateAsync(input);
              toast.success(`Invoice ${inv.invoiceNumber} created`);
              router.push(`/invoices/${inv._id}`);
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Failed to create invoice';
              toast.error(msg);
            }
          }}
        />
      </div>
    </div>
  );
}
