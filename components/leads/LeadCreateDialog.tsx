'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCreateLead } from '@/hooks/useLeads';
import { ApiError } from '@/lib/utils/apiFetch';

import { LeadForm } from './LeadForm';

type Props = { trigger: React.ReactNode };

export function LeadCreateDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const create = useCreateLead();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>Capture an inquiry to track through your pipeline.</DialogDescription>
        </DialogHeader>
        <LeadForm
          submitLabel="Create lead"
          isSubmitting={create.isPending}
          onCancel={() => setOpen(false)}
          onSubmit={async (data) => {
            try {
              const lead = await create.mutateAsync(data);
              toast.success(`${lead.firstName} ${lead.lastName} added`);
              setOpen(false);
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Failed to create lead';
              toast.error(msg);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
