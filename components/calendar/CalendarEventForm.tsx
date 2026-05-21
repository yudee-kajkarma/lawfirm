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
import {
  calendarEventCreateSchema,
  type CalendarEventCreateInput,
} from '@/lib/utils/validators/calendarEvent';

export type CalendarEventFormValues = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string;
  meetingUrl: string;
  businessUnit: string;
};

const EMPTY: CalendarEventFormValues = {
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  allDay: false,
  location: '',
  meetingUrl: '',
  businessUnit: '',
};

type Props = {
  defaultValues?: Partial<CalendarEventFormValues>;
  lockedBusinessUnit?: string;
  onSubmit: (data: CalendarEventCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
};

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

export function CalendarEventForm({
  defaultValues,
  lockedBusinessUnit,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  isSubmitting = false,
}: Props) {
  const { businessUnits, currentBU } = useBusinessUnit();
  const { isAdmin } = useCurrentUser();

  const computedDefaultBU =
    lockedBusinessUnit ??
    defaultValues?.businessUnit ??
    (currentBU !== 'all' ? currentBU : businessUnits.length === 1 ? businessUnits[0]!.key : '');

  const form = useForm<CalendarEventFormValues>({
    resolver: zodResolver(calendarEventCreateSchema) as never,
    defaultValues: { ...EMPTY, ...defaultValues, businessUnit: computedDefaultBU },
  });

  useEffect(() => {
    if (!defaultValues?.businessUnit && form.getValues('businessUnit') === '') {
      form.setValue('businessUnit', computedDefaultBU);
    }
  }, [computedDefaultBU, defaultValues?.businessUnit, form]);

  const { register, handleSubmit, control, formState } = form;
  const { errors } = formState;
  const buLocked = !!lockedBusinessUnit || (!isAdmin && businessUnits.length === 1);

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data as unknown as CalendarEventCreateInput))}
      className="space-y-5"
    >
      <Field label="Title" required error={errors.title?.message}>
        <Input autoFocus {...register('title')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" required error={errors.startsAt?.message}>
          <Input type="datetime-local" {...register('startsAt')} />
        </Field>
        <Field label="Ends" required error={errors.endsAt?.message}>
          <Input type="datetime-local" {...register('endsAt')} />
        </Field>
      </div>

      <Label className="flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          {...register('allDay')}
          className="size-4 rounded border-border accent-primary"
        />
        All-day event
      </Label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Location" error={errors.location?.message}>
          <Input placeholder="Office, address, city…" {...register('location')} />
        </Field>
        <Field label="Meeting URL" error={errors.meetingUrl?.message}>
          <Input placeholder="https://…" {...register('meetingUrl')} />
        </Field>
      </div>

      {!lockedBusinessUnit && (
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
      )}

      <Field label="Description" error={errors.description?.message}>
        <Textarea rows={3} {...register('description')} />
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

/** Converts a UTC ISO string into the local YYYY-MM-DDTHH:mm a datetime-local input expects. */
export function isoToDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  const local = new Date(d.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 16);
}
