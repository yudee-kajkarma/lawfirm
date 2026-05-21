import { z } from 'zod';

import { CASE_STATUSES } from '@/lib/constants/enums';
import { isValidObjectIdString } from '@/lib/utils/objectId';

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

const objectIdString = z.string().refine(isValidObjectIdString, { message: 'Invalid id' });

export const caseCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: trimmedString(5000).nullish(),
  caseType: trimmedString(100).nullish(),
  status: z.enum(CASE_STATUSES).default('open'),
  businessUnit: z.string().min(1),
  clientId: objectIdString,
  assignedTo: objectIdString.nullish(),
  value: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : v),
      z.coerce.number().min(0).finite().nullable(),
    )
    .optional(),
  tags: z.array(z.string().trim().max(50)).default([]),
});

// `.partial()` makes fields optional in the input, but Zod's `.default()`
// still fires when a field is absent — silently overwrites existing values
// on PATCH. Re-declare every defaulted field as a plain `.optional()`.
export const caseUpdateSchema = caseCreateSchema.partial().extend({
  status: z.enum(CASE_STATUSES).optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
});

export type CaseCreateInput = z.infer<typeof caseCreateSchema>;
export type CaseUpdateInput = z.infer<typeof caseUpdateSchema>;

export const convertLeadSchema = z.object({
  caseTitle: z.string().trim().min(1).max(200),
  caseType: trimmedString(100).nullish(),
  assignedTo: objectIdString.nullish(),
  // If provided, the lead is linked to an existing Contact instead of
  // spinning up a new one from the lead's fields.
  existingContactId: objectIdString.nullish(),
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
