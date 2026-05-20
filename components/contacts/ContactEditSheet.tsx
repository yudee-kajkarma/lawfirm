'use client';

import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useUpdateContact } from '@/hooks/useContacts';
import { ApiError } from '@/lib/utils/apiFetch';
import type { Contact } from '@/types/contact';

import { ContactForm } from './ContactForm';

type Props = {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ContactEditSheet({ contact, open, onOpenChange }: Props) {
  const update = useUpdateContact();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Edit contact</SheetTitle>
          <SheetDescription>
            Updating {contact.firstName} {contact.lastName}.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <ContactForm
            submitLabel="Save changes"
            isSubmitting={update.isPending}
            onCancel={() => onOpenChange(false)}
            defaultValues={{
              firstName: contact.firstName,
              lastName: contact.lastName,
              email: contact.email ?? '',
              phone: contact.phone ?? '',
              contactType: contact.contactType,
              businessUnit: contact.businessUnit,
              companyName: contact.companyName ?? '',
              jobTitle: contact.jobTitle ?? '',
              notes: contact.notes ?? '',
            }}
            onSubmit={async (data) => {
              try {
                await update.mutateAsync({ id: contact._id, patch: data });
                toast.success('Contact updated');
                onOpenChange(false);
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to update contact';
                toast.error(msg);
              }
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
