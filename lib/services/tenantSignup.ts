import mongoose from 'mongoose';

import { hashPassword } from '@/lib/auth/password';
import { connectDb } from '@/lib/db/connect';
import { BusinessUnit } from '@/lib/models/BusinessUnit';
import { Settings } from '@/lib/models/Settings';
import { Tenant, type TenantDoc } from '@/lib/models/Tenant';
import { User, type UserDoc } from '@/lib/models/User';
import { ConflictError } from '@/lib/utils/errors';
import type { TenantSignupInput } from '@/lib/utils/validators/tenant';

import { generateUniqueTenantSlug } from './tenantSlug';

const DEFAULT_BUS = [
  {
    key: 'immigration',
    name: 'Immigration',
    description: 'Visa applications, status tracking, document workflows.',
    color: '#0ea5e9',
    order: 1,
  },
  {
    key: 'law',
    name: 'Law',
    description: 'Case management, hearings, billable time.',
    color: '#8b5cf6',
    order: 2,
  },
  {
    key: 'wealth',
    name: 'Wealth',
    description: 'Portfolio reviews, advisory cases, compliance.',
    color: '#10b981',
    order: 3,
  },
] as const;

export type TenantSignupResult = {
  tenant: TenantDoc;
  user: UserDoc;
};

/**
 * Signs up a new tenant. Runs in a transaction across 4 collections so a
 * partial signup is impossible. Throws ConflictError if the email is already
 * in use anywhere (spec §5.4: one email = one tenant, soft-enforced at signup
 * via a global lookup that spans User AND — once MT-3 lands — PlatformOperator).
 */
export async function performTenantSignup(
  input: TenantSignupInput,
): Promise<TenantSignupResult> {
  await connectDb();

  // Global email pre-check OUTSIDE the transaction. Spec §5.4 — emails are
  // globally unique across all tenants. Doing it pre-transaction avoids
  // holding write locks during the validation; the transaction's compound
  // unique on (tenantId, email) is still the durable guarantee.
  const existing = await User.findOne({ email: input.ownerEmail }).setOptions({
    withDeleted: true,
    __crossTenant: true,
  });
  if (existing) {
    throw new ConflictError('That email is already in use');
  }

  const session = await mongoose.startSession();
  try {
    let result: TenantSignupResult | null = null;
    await session.withTransaction(async () => {
      const slug = await generateUniqueTenantSlug(input.companyName, session);

      const [tenant] = await Tenant.create(
        [
          {
            name: input.companyName.trim(),
            slug,
            status: 'active',
            ownerEmail: input.ownerEmail,
          },
        ],
        { session },
      );
      if (!tenant) throw new Error('Tenant.create returned no doc');

      const tenantId = tenant._id;

      for (const bu of DEFAULT_BUS) {
        const [created] = await BusinessUnit.create([{ ...bu, tenantId }], { session });
        if (!created) throw new Error(`BusinessUnit.create returned no doc for ${bu.key}`);
      }

      const passwordHash = await hashPassword(input.password);
      const [user] = await User.create(
        [
          {
            tenantId,
            email: input.ownerEmail,
            name: input.ownerName,
            passwordHash,
            isAdmin: true,
            businessUnits: DEFAULT_BUS.map((b) => b.key),
            isActive: true,
          },
        ],
        { session },
      );
      if (!user) throw new Error('User.create returned no doc');

      await Settings.create([{ tenantId, organizationName: input.companyName.trim() }], {
        session,
      });

      result = { tenant, user };
    });

    if (!result) throw new Error('Signup transaction returned no result');
    return result;
  } finally {
    await session.endSession();
  }
}
