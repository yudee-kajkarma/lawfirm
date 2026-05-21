'use client';

import type { EventInput } from '@fullcalendar/core';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { CalendarBoard } from '@/components/calendar/CalendarBoard';
import { CalendarEventCreateDialog } from '@/components/calendar/CalendarEventCreateDialog';
import { CalendarEventEditSheet } from '@/components/calendar/CalendarEventEditSheet';
import { isoToDateTimeLocal } from '@/components/calendar/CalendarEventForm';
import { Button } from '@/components/ui/button';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import {
  useCalendarEvents,
  useUpdateCalendarEvent,
} from '@/hooks/useCalendarEvents';
import { ApiError } from '@/lib/utils/apiFetch';
import type { CalendarEvent } from '@/types/calendarEvent';

import './calendar.css';

export function CalendarClient() {
  const { currentBU, businessUnits } = useBusinessUnit();
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [createState, setCreateState] = useState<{
    open: boolean;
    start?: string;
    end?: string;
    allDay?: boolean;
  }>({ open: false });
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const filters = useMemo(
    () => ({
      start: range?.start.toISOString(),
      end: range?.end.toISOString(),
      businessUnit: currentBU !== 'all' ? currentBU : undefined,
    }),
    [range, currentBU],
  );

  const query = useCalendarEvents(filters);
  const update = useUpdateCalendarEvent();

  const buColor = (key: string) => businessUnits.find((bu) => bu.key === key)?.color ?? '#64748b';
  const eventsById = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    for (const e of query.data ?? []) map.set(e._id, e);
    return map;
  }, [query.data]);

  const events: EventInput[] = useMemo(
    () =>
      (query.data ?? []).map((e) => {
        const color = e.color ?? buColor(e.businessUnit);
        return {
          id: e._id,
          title: e.title,
          start: e.startsAt,
          end: e.endsAt,
          allDay: e.allDay,
          backgroundColor: color,
          borderColor: color,
          textColor: '#fff',
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, businessUnits],
  );

  return (
    <div className="space-y-3 p-6">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          className="gap-2"
          onClick={() => setCreateState({ open: true })}
          disabled={currentBU === 'all' && businessUnits.length > 1}
          title={
            currentBU === 'all' && businessUnits.length > 1
              ? 'Pick a specific business unit before creating events'
              : undefined
          }
        >
          <Plus className="size-4" />
          New event
        </Button>
      </div>

      <CalendarBoard
        events={events}
        onRangeChange={(r) => {
          // Avoid an infinite re-render loop — only setState when the range
          // actually shifts (FullCalendar fires datesSet on every render).
          setRange((prev) =>
            prev && prev.start.getTime() === r.start.getTime() && prev.end.getTime() === r.end.getTime()
              ? prev
              : r,
          );
        }}
        onSelect={(sel) => {
          setCreateState({
            open: true,
            start: isoToDateTimeLocal(sel.start.toISOString()),
            end: isoToDateTimeLocal(sel.end.toISOString()),
            allDay: sel.allDay,
          });
        }}
        onEventClick={(id) => {
          const event = eventsById.get(id);
          if (event) setEditing(event);
        }}
        onEventChange={async ({ id, start, end, allDay, revert }) => {
          // FullCalendar gives us a null end for instantaneous moves of all-day
          // events. Fall back to start+1h so the API is always handed a valid range.
          const computedEnd = end ?? new Date(start.getTime() + 60 * 60 * 1000);
          try {
            await update.mutateAsync({
              id,
              patch: { startsAt: start, endsAt: computedEnd, allDay },
            });
          } catch (e) {
            // `revert()` snaps the event back to its pre-drag position via
            // FullCalendar's own internal state — instant, doesn't need the
            // network. Refetching wouldn't help here because the data is
            // already correct; the visual is the thing that needs undoing.
            revert();
            const msg = e instanceof ApiError ? e.message : 'Failed to move event';
            toast.error(msg);
          }
        }}
      />

      <CalendarEventCreateDialog
        open={createState.open}
        onOpenChange={(o) => setCreateState({ open: o })}
        defaultValues={{
          startsAt: createState.start ?? '',
          endsAt: createState.end ?? '',
          allDay: createState.allDay ?? false,
        }}
        lockedBusinessUnit={currentBU !== 'all' ? currentBU : undefined}
      />

      {editing && (
        <CalendarEventEditSheet
          event={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}
