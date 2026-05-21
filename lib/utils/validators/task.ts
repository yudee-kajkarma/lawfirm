import { z } from 'zod';

import {
  POLY_RELATED_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@/lib/constants/enums';
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

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: trimmedString(5000).nullish(),
  status: z.enum(TASK_STATUSES).default('todo'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  businessUnit: z.string().min(1),
  relatedTo: relatedToSchema.optional(),
  assignedTo: objectIdString.nullish(),
  dueDate: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : v),
      z.coerce.date().nullable(),
    )
    .optional(),
  tags: z.array(z.string().trim().max(50)).default([]),
});

// `.partial()` keeps Zod defaults firing on missing keys (see
// project_zod_partial_defaults.md). Re-declare every defaulted field as
// plain `.optional()` so a PATCH only touches what the caller actually sent.
export const taskUpdateSchema = taskCreateSchema.partial().extend({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
