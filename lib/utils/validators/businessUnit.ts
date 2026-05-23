import { z } from 'zod';

// Lowercase, URL-safe slug. Allows letters, digits, hyphens, underscores. No
// dots, spaces, or slashes — this key shows up in business-record fields and
// gets compared exactly, so we keep it tight.
const keySchema = z
  .string()
  .trim()
  .min(1, 'Key is required')
  .max(40, 'Key is too long (max 40 characters)')
  .regex(
    /^[a-z0-9][a-z0-9_-]*$/,
    'Key must be lowercase letters/digits with - or _ separators and start with a letter or digit',
  );

// Accept either #RGB or #RRGGBB.
const colorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a hex code like #1d4ed8');

const trimmedNullable = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

export const businessUnitCreateSchema = z.object({
  key: keySchema,
  name: z.string().trim().min(1).max(100),
  description: trimmedNullable(500).nullish(),
  color: colorSchema.default('#64748b'),
  order: z.coerce.number().int().min(0).max(9999).default(100),
  isActive: z.boolean().default(true),
});

// Update schema — `key` is intentionally excluded. Renaming a BU's key would
// orphan every record that already references it; we never expose this as
// an editable field.
export const businessUnitUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: trimmedNullable(500).nullish(),
  color: colorSchema.optional(),
  order: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export type BusinessUnitCreateInput = z.infer<typeof businessUnitCreateSchema>;
export type BusinessUnitUpdateInput = z.infer<typeof businessUnitUpdateSchema>;
