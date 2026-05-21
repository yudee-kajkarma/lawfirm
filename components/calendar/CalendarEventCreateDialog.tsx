'use client';

import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateCalendarEvent } from '@/hooks/useCalendarEvents';
import { ApiError } from '@/lib/utils/apiFetch';

import { CalendarEventForm, type CalendarEventFormValues } from './CalendarEventForm';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<CalendarEventFormValues>;
  lockedBusinessUnit?: string;
};

export function CalendarEventCreateDialog({
  open,
  onOpenChange,
  defaultValues,
  lockedBusinessUnit,
}: Props) {
  const create = useCreateCalendarEvent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>
            Add a meeting, hearing, or reminder to the team calendar.
          </DialogDescription>
        </DialogHeader>
        <CalendarEventForm
          submitLabel="Create event"
          isSubmitting={create.isPending}
          defaultValues={defaultValues}
          lockedBusinessUnit={lockedBusinessUnit}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (data) => {
            try {
              await create.mutateAsync(data);
              toast.success('Event created');
              onOpenChange(false);
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Failed to create event';
              toast.error(msg);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
