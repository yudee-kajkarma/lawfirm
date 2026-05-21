import { z } from 'zod';

import { CONTACT_TYPES } from '@/lib/constants/enums';

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

const addressSchema = z
  .object({
    street: trimmedString(200).nullish(),
    city: trimmedString(100).nullish(),
    state: trimmedString(100).nullish(),
    postalCode: trimmedString(40).nullish(),
    country: trimmedString(100).nullish(),
  })
  .partial()
  .nullish();

export const contactCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z
    .union([z.string().email().max(200).transform((v) => v.toLowerCase()), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  phone: trimmedString(40).nullish(),
  contactType: z.enum(CONTACT_TYPES).default('client'),
  businessUnit: z.string().min(1),
  companyName: trimmedString(200).nullish(),
  jobTitle: trimmedString(200).nullish(),
  address: addressSchema,
  tags: z.array(z.string().trim().max(50)).default([]),
  notes: trimmedString(5000).nullish(),
});

// `.partial()` makes fields optional in the input, but Zod's `.default()`
// still fires when a field is absent — silently overwrites existing values
// on PATCH. Re-declare every defaulted field as a plain `.optional()`.
export const contactUpdateSchema = contactCreateSchema.partial().extend({
  contactType: z.enum(CONTACT_TYPES).optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
});

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
