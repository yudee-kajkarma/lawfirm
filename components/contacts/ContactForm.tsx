'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { CONTACT_TYPES } from '@/lib/constants/enums';
import { cn } from '@/lib/utils';
import {
  contactCreateSchema,
  type ContactCreateInput,
} from '@/lib/utils/validators/contact';

export type ContactFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  contactType: ContactCreateInput['contactType'];
  businessUnit: string;
  companyName: string;
  jobTitle: string;
  notes: string;
};

const EMPTY_VALUES: ContactFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  contactType: 'client',
  businessUnit: '',
  companyName: '',
  jobTitle: '',
  notes: '',
};

type Props = {
  defaultValues?: Partial<ContactFormValues>;
  onSubmit: (data: ContactCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
};

function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>;
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ContactForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  isSubmitting = false,
}: Props) {
  const { businessUnits, currentBU } = useBusinessUnit();
  const { isAdmin } = useCurrentUser();

  // Pick a sane default BU for the create case:
  //   1. Caller-provided default (edit path)
  //   2. The currently-selected BU in the header (if not 'all')
  //   3. The user's single BU (if they only have one)
  //   4. Empty — user must pick
  const computedDefaultBU =
    defaultValues?.businessUnit ??
    (currentBU !== 'all' ? currentBU : businessUnits.length === 1 ? businessUnits[0]!.key : '');

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactCreateSchema) as never,
    defaultValues: { ...EMPTY_VALUES, ...defaultValues, businessUnit: computedDefaultBU },
  });

  // Keep BU default in sync if the header BU changes while the form is open.
  useEffect(() => {
    if (!defaultValues?.businessUnit && form.getValues('businessUnit') === '') {
      form.setValue('businessUnit', computedDefaultBU);
    }
  }, [computedDefaultBU, defaultValues?.businessUnit, form]);

  const { register, handleSubmit, control, formState } = form;
  const { errors } = formState;

  // Standard users with only one BU shouldn't see a meaningful dropdown.
  const buLocked = !isAdmin && businessUnits.length === 1;

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data as ContactCreateInput))}
      className="space-y-5"
    >
      <FieldRow>
        <Field label="First name" required error={errors.firstName?.message}>
          <Input autoFocus {...register('firstName')} />
        </Field>
        <Field label="Last name" required error={errors.lastName?.message}>
          <Input {...register('lastName')} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" placeholder="name@example.com" {...register('email')} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input type="tel" {...register('phone')} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Contact type" required error={errors.contactType?.message}>
          <Controller
            control={control}
            name="contactType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label="Business unit" required error={errors.businessUnit?.message}>
          <Controller
            control={control}
            name="businessUnit"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={buLocked}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a business unit" />
                </SelectTrigger>
                <SelectContent>
                  {businessUnits.map((bu) => (
                    <SelectItem key={bu.key} value={bu.key}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ backgroundColor: bu.color }}
                        />
                        {bu.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Company" error={errors.companyName?.message}>
          <Input {...register('companyName')} />
        </Field>
        <Field label="Job title" error={errors.jobTitle?.message}>
          <Input {...register('jobTitle')} />
        </Field>
      </FieldRow>

      <Field label="Notes" error={errors.notes?.message}>
        <Textarea rows={3} {...register('notes')} />
      </Field>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
