'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type {
  CalendarEventCreateInput,
  CalendarEventUpdateInput,
} from '@/lib/utils/validators/calendarEvent';
import type {
  CalendarEvent,
  CalendarEventListFilters,
} from '@/types/calendarEvent';

const KEY = ['calendarEvents'] as const;

function buildQS(filters: CalendarEventListFilters): string {
  const sp = new URLSearchParams();
  if (filters.start) sp.set('start', filters.start);
  if (filters.end) sp.set('end', filters.end);
  if (filters.businessUnit) sp.set('businessUnit', filters.businessUnit);
  if (filters.relatedToType) sp.set('relatedToType', filters.relatedToType);
  if (filters.relatedToId) sp.set('relatedToId', filters.relatedToId);
  return sp.toString();
}

export function useCalendarEvents(filters: CalendarEventListFilters) {
  const enabled = !!filters.start && !!filters.end;
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    enabled,
    queryFn: async () => {
      const qs = buildQS(filters);
      const res = await apiFetch<CalendarEvent[]>(`/api/calendar-events${qs ? `?${qs}` : ''}`);
      return res.data;
    },
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CalendarEventCreateInput) => {
      const res = await apiFetch<CalendarEvent>('/api/calendar-events', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: CalendarEventUpdateInput }) => {
      const res = await apiFetch<CalendarEvent>(`/api/calendar-events/${args.id}`, {
        method: 'PATCH',
        body: JSON.stringify(args.patch),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ _id: string }>(`/api/calendar-events/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}
