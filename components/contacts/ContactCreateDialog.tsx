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
import { useCreateContact } from '@/hooks/useContacts';
import { ApiError } from '@/lib/utils/apiFetch';

import { ContactForm } from './ContactForm';

type Props = { trigger: React.ReactNode };

export function ContactCreateDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const create = useCreateContact();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
          <DialogDescription>Add a person or company to your CRM.</DialogDescription>
        </DialogHeader>
        <ContactForm
          submitLabel="Create contact"
          isSubmitting={create.isPending}
          onCancel={() => setOpen(false)}
          onSubmit={async (data) => {
            try {
              const contact = await create.mutateAsync(data);
              toast.success(`${contact.firstName} ${contact.lastName} added`);
              setOpen(false);
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Failed to create contact';
              toast.error(msg);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
