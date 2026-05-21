import type { PolyRelatedType } from '@/lib/constants/enums';

export type CalendarEventRelatedTo = {
  type: PolyRelatedType;
  id: string;
};

export type CalendarEvent = {
  _id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  meetingUrl: string | null;
  businessUnit: string;
  relatedTo: CalendarEventRelatedTo | null;
  color: string | null;
  attendees: string[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventListFilters = {
  /** ISO date — start of the visible range (inclusive). */
  start?: string;
  /** ISO date — end of the visible range (exclusive). */
  end?: string;
  businessUnit?: string;
  relatedToType?: PolyRelatedType;
  relatedToId?: string;
};
