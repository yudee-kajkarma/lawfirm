import { z } from 'zod';

import { POLY_RELATED_TYPES } from '@/lib/constants/enums';
import { isValidObjectIdString } from '@/lib/utils/objectId';

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

const objectIdString = z.string().refine(isValidObjectIdString, { message: 'Invalid id' });

const relatedToSchema = z
  .object({
    type: z.enum(POLY_RELATED_TYPES),
    id: objectIdString,
  })
  .nullable();

// HTML datetime-local sends `YYYY-MM-DDTHH:mm` (no tz). z.coerce.date treats
// that as local; ISO strings with `Z` or offsets parse correctly too. Date
// objects pass through.
const dateInput = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.coerce.date(),
);

export const calendarEventCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: trimmedString(5000).nullish(),
    startsAt: dateInput,
    endsAt: dateInput,
    allDay: z.boolean().default(false),
    location: trimmedString(300).nullish(),
    meetingUrl: trimmedString(1000).nullish(),
    businessUnit: z.string().min(1),
    relatedTo: relatedToSchema.optional(),
    color: trimmedString(20).nullish(),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: 'End must be after start',
    path: ['endsAt'],
  });

export const calendarEventUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: trimmedString(5000).nullish(),
    startsAt: dateInput.optional(),
    endsAt: dateInput.optional(),
    allDay: z.boolean().optional(),
    location: trimmedString(300).nullish(),
    meetingUrl: trimmedString(1000).nullish(),
    businessUnit: z.string().min(1).optional(),
    relatedTo: relatedToSchema.optional(),
    color: trimmedString(20).nullish(),
  })
  // Both endpoints (start/end) must satisfy the order constraint, but only
  // when both are present in the patch. If only one is supplied the server
  // applies it onto the existing doc and re-validates there.
  .refine((d) => !d.startsAt || !d.endsAt || d.endsAt > d.startsAt, {
    message: 'End must be after start',
    path: ['endsAt'],
  });

export type CalendarEventCreateInput = z.infer<typeof calendarEventCreateSchema>;
export type CalendarEventUpdateInput = z.infer<typeof calendarEventUpdateSchema>;
