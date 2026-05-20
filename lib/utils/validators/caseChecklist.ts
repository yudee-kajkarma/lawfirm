import { z } from 'zod';

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

export const checklistCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: trimmedString(1000).nullish(),
  dueDate: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : v),
      z.coerce.date().nullable(),
    )
    .optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const checklistUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: trimmedString(1000).nullish(),
    dueDate: z
      .preprocess(
        (v) => (v === '' || v === null || v === undefined ? null : v),
        z.coerce.date().nullable(),
      )
      .optional(),
    completed: z.boolean(),
    order: z.coerce.number().int().min(0),
  })
  .partial();

export type ChecklistCreateInput = z.infer<typeof checklistCreateSchema>;
export type ChecklistUpdateInput = z.infer<typeof checklistUpdateSchema>;
