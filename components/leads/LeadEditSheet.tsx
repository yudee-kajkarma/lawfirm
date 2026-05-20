'use client';

import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useUpdateLead } from '@/hooks/useLeads';
import { ApiError } from '@/lib/utils/apiFetch';
import type { Lead } from '@/types/lead';

import { LeadForm } from './LeadForm';

type Props = {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// HTML <input type="date"> uses YYYY-MM-DD; strip time + tz off the wire ISO.
function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function LeadEditSheet({ lead, open, onOpenChange }: Props) {
  const update = useUpdateLead();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Edit lead</SheetTitle>
          <SheetDescription>
            Updating {lead.firstName} {lead.lastName}.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <LeadForm
            submitLabel="Save changes"
            isSubmitting={update.isPending}
            onCancel={() => onOpenChange(false)}
            defaultValues={{
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email ?? '',
              phone: lead.phone ?? '',
              source: lead.source,
              stage: lead.stage,
              businessUnit: lead.businessUnit,
              companyName: lead.companyName ?? '',
              jobTitle: lead.jobTitle ?? '',
              value: lead.value != null ? String(lead.value) : '',
              expectedCloseDate: isoToDateInput(lead.expectedCloseDate),
              notes: lead.notes ?? '',
            }}
            onSubmit={async (data) => {
              try {
                await update.mutateAsync({ id: lead._id, patch: data });
                toast.success('Lead updated');
                onOpenChange(false);
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to update lead';
                toast.error(msg);
              }
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
