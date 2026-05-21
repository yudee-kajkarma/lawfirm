'use client';

import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';

type EventChangeArgs = {
  id: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  /**
   * FullCalendar's one-shot undo for the visual drag/resize. Call this from
   * the failure branch to snap the event back to where it was — no network
   * roundtrip needed (FullCalendar manages its own internal state).
   */
  revert: () => void;
};

type Props = {
  events: EventInput[];
  onRangeChange: (range: { start: Date; end: Date }) => void;
  onSelect: (args: { start: Date; end: Date; allDay: boolean }) => void;
  onEventClick: (id: string) => void;
  onEventChange: (args: EventChangeArgs) => void;
};

export function CalendarBoard({
  events,
  onRangeChange,
  onSelect,
  onEventClick,
  onEventChange,
}: Props) {
  return (
    <div className="instapath-fc">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={events}
        editable
        selectable
        selectMirror
        dayMaxEvents
        nowIndicator
        height="calc(100vh - 11rem)"
        datesSet={(arg: DatesSetArg) => onRangeChange({ start: arg.start, end: arg.end })}
        select={(arg: DateSelectArg) =>
          onSelect({ start: arg.start, end: arg.end, allDay: arg.allDay })
        }
        eventClick={(arg: EventClickArg) => onEventClick(arg.event.id)}
        eventDrop={(arg: EventDropArg) =>
          onEventChange({
            id: arg.event.id,
            start: arg.event.start ?? new Date(),
            end: arg.event.end,
            allDay: arg.event.allDay,
            revert: arg.revert,
          })
        }
        eventResize={(arg: EventResizeDoneArg) =>
          onEventChange({
            id: arg.event.id,
            start: arg.event.start ?? new Date(),
            end: arg.event.end,
            allDay: arg.event.allDay,
            revert: arg.revert,
          })
        }
      />
    </div>
  );
}
