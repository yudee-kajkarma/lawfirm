import { z } from 'zod';

export const operatorCreateSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(120).trim(),
  password: z.string().min(8).max(200),
});
export type OperatorCreateInput = z.infer<typeof operatorCreateSchema>;

export const operatorActionSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type OperatorActionInput = z.infer<typeof operatorActionSchema>;
