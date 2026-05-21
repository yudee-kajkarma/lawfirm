import { z } from 'zod';

import { SMART_LIST_ENTITIES, SMART_LIST_OPERATORS } from '@/lib/utils/smartListFields';

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

// Conditions are loosely typed at the schema level — the translator runs the
// deep validation (field whitelist, operator-value coupling, etc).
const filterConditionSchema = z.object({
  field: z.string().min(1).max(100),
  operator: z.enum(SMART_LIST_OPERATORS),
  value: z.unknown(),
});

const filterTreeSchema = z.object({
  conjunction: z.enum(['and', 'or']),
  conditions: z.array(filterConditionSchema).max(50),
});

export const smartListCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: trimmedString(1000).nullish(),
  entity: z.enum(SMART_LIST_ENTITIES),
  businessUnit: z.string().min(1),
  filterTree: filterTreeSchema,
});

// Entity is intentionally NOT updatable — changing it would invalidate the
// existing filterTree against a different whitelist.
export const smartListUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: trimmedString(1000).nullish(),
  filterTree: filterTreeSchema.optional(),
});

export type SmartListCreateInput = z.infer<typeof smartListCreateSchema>;
export type SmartListUpdateInput = z.infer<typeof smartListUpdateSchema>;
