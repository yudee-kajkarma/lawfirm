import { z } from 'zod';

import { TENANT_STATUSES } from '@/lib/models/Tenant';

/**
 * Used by the signup endpoint in MT-2. Defined here in MT-0 so the type is
 * available the moment signup is wired up.
 *
 * `companyName` becomes `Tenant.name`. The slug is derived server-side from
 * the company name with a uniqueness suffix on collision — never client-input.
 */
export const tenantSignupSchema = z.object({
  companyName: z.string().min(1).max(120).trim(),
  ownerName: z.string().min(1).max(120).trim(),
  ownerEmail: z.string().email().toLowerCase(),
  password: z.string().min(8).max(200),
});

export type TenantSignupInput = z.infer<typeof tenantSignupSchema>;

export const tenantStatusSchema = z.enum(TENANT_STATUSES);
