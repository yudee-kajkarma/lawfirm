import { z } from 'zod';

import { LEAD_SOURCES, LEAD_STAGES } from '@/lib/constants/enums';
import { isValidObjectIdString } from '@/lib/utils/objectId';

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

const objectIdString = z
  .string()
  .refine(isValidObjectIdString, { message: 'Invalid id' });

export const leadCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z
    .union([z.string().email().max(200).transform((v) => v.toLowerCase()), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  phone: trimmedString(40).nullish(),

  source: z.enum(LEAD_SOURCES).default('other'),
  stage: z.enum(LEAD_STAGES).default('new_inquiry'),

  businessUnit: z.string().min(1),
  assignedTo: objectIdString.nullish(),

  companyName: trimmedString(200).nullish(),
  jobTitle: trimmedString(200).nullish(),

  // Forms send '' for empty number inputs and HTML number fields give strings.
  // `preprocess` normalizes empties to null *before* the inner type runs, so
  // z.coerce.number doesn't silently turn '' into 0.
  value: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : v),
      z.coerce.number().min(0).finite().nullable(),
    )
    .optional(),

  // Same idea for the HTML date input — accept '' / null / undefined / ISO
  // string / Date. Output is `Date | null`.
  expectedCloseDate: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : v),
      z.coerce.date().nullable(),
    )
    .optional(),

  notes: trimmedString(5000).nullish(),
  tags: z.array(z.string().trim().max(50)).default([]),
});

// `.partial()` makes fields optional in the input, but Zod's `.default()`
// still fires when a field is absent from the parsed result. For PATCH that
// silently overwrites existing values — re-declare every defaulted field
// as a plain `.optional()` so missing keys stay missing.
export const leadUpdateSchema = leadCreateSchema.partial().extend({
  source: z.enum(LEAD_SOURCES).optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;
