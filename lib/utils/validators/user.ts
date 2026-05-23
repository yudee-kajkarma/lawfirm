import { z } from 'zod';

// Password rules: min 8 chars (industry minimum), max 100 (bcrypt cuts off at
// 72 bytes anyway, but we accept a bit more so the UI can still reject without
// silent truncation). No complexity gate — admin chooses, full responsibility.
const passwordSchema = z.string().min(8, 'At least 8 characters').max(100);

export const userCreateSchema = z.object({
  email: z.string().email().max(200).transform((v) => v.toLowerCase().trim()),
  name: z.string().trim().min(1).max(100),
  password: passwordSchema,
  isAdmin: z.boolean().default(false),
  businessUnits: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().default(true),
});

// `.partial()` makes fields optional in the input, but Zod's `.default()`
// still fires when a field is absent — re-declare every defaulted field as a
// plain `.optional()` so absent fields don't silently overwrite.
export const userUpdateSchema = userCreateSchema
  .omit({ password: true }) // password has its own endpoint
  .partial()
  .extend({
    isAdmin: z.boolean().optional(),
    isActive: z.boolean().optional(),
    businessUnits: z.array(z.string().trim().min(1)).optional(),
  });

export const userPasswordSchema = z.object({
  password: passwordSchema,
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserPasswordInput = z.infer<typeof userPasswordSchema>;
