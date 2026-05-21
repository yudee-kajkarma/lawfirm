'use client';

import { Trash2 } from 'lucide-react';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDeleteCalendarEvent, useUpdateCalendarEvent } from '@/hooks/useCalendarEvents';
import { ApiError } from '@/lib/utils/apiFetch';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendarEvent';

import { CalendarEventForm, isoToDateTimeLocal } from './CalendarEventForm';

type Props = {
  event: CalendarEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CalendarEventEditSheet({ event, open, onOpenChange }: Props) {
  const update = useUpdateCalendarEvent();
  const del = useDeleteCalendarEvent();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Edit event</SheetTitle>
            <SheetDescription>{event.title}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <CalendarEventForm
              submitLabel="Save changes"
              isSubmitting={update.isPending}
              lockedBusinessUnit={event.businessUnit}
              defaultValues={{
                title: event.title,
                description: event.description ?? '',
                startsAt: isoToDateTimeLocal(event.startsAt),
                endsAt: isoToDateTimeLocal(event.endsAt),
                allDay: event.allDay,
                location: event.location ?? '',
                meetingUrl: event.meetingUrl ?? '',
                businessUnit: event.businessUnit,
              }}
              onCancel={() => onOpenChange(false)}
              onSubmit={async (data) => {
                try {
                  await update.mutateAsync({ id: event._id, patch: data });
                  toast.success('Event updated');
                  onOpenChange(false);
                } catch (e) {
                  const msg = e instanceof ApiError ? e.message : 'Failed to update event';
                  toast.error(msg);
                }
              }}
            />
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" />
                Delete event
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{event.title}&rdquo; will be soft-deleted. Audit log is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'destructive' }))}
              disabled={del.isPending}
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await del.mutateAsync(event._id);
                  toast.success('Event deleted');
                  setDeleteOpen(false);
                  onOpenChange(false);
                } catch (e) {
                  const msg = e instanceof ApiError ? e.message : 'Failed to delete event';
                  toast.error(msg);
                }
              }}
            >
              {del.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
