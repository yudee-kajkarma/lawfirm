import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import authConfig from './auth.config';
import { verifyPassword } from '@/lib/auth/password';
import { connectDb } from '@/lib/db/connect';
import { PlatformOperator } from '@/lib/models/PlatformOperator';
import { Tenant } from '@/lib/models/Tenant';
import { User } from '@/lib/models/User';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Thrown when an otherwise-valid login (email + password match) is refused
 * because the user's tenant isn't active. The `code` flows through to the
 * client's signIn result so the login form can route to /suspended instead
 * of showing the generic "invalid credentials" banner.
 */
class TenantSuspendedSignin extends CredentialsSignin {
  code = 'TenantSuspended';
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        await connectDb();

        // 1. Try User (tenant user).
        // Login is intentionally a cross-tenant lookup: email is globally unique
        // across User (soft-enforced at signup, spec §5.4) so a single email
        // resolves to exactly one tenant. Without __crossTenant the new
        // tenantScopePlugin would throw because the query has no tenantId yet.
        const userDoc = await User.findOne({ email })
          .setOptions({ __crossTenant: true })
          .select('+passwordHash');

        if (userDoc) {
          if (!userDoc.isActive) return null;
          const okUser = await verifyPassword(parsed.data.password, userDoc.passwordHash);
          if (!okUser) return null;

          // A user without tenantId means the seed/migration missed this record.
          // Refuse login rather than letting them into an unscoped session.
          if (!userDoc.tenantId) return null;

          // Spec §5.2: refuse sign-in if tenant is anything other than active.
          // suspended → "Your firm's account is suspended"; pending_purge / purging
          // → same message (operator console can show finer grain later).
          // Throw a distinguishable error so the login form can route to
          // /suspended instead of showing the generic "invalid credentials".
          const tenantDoc = await Tenant.findById(userDoc.tenantId).lean();
          if (!tenantDoc || tenantDoc.status !== 'active') {
            throw new TenantSuspendedSignin();
          }

          // Bump last-login. Use updateOne (not .save()) so we skip both
          // audit-log entries and the audit-fields `updatedBy` hook — this isn't
          // a user-driven mutation worth tracking. Filter includes tenantId so
          // tenantScopePlugin is satisfied.
          await User.updateOne(
            { _id: userDoc._id, tenantId: userDoc.tenantId },
            { lastLoginAt: new Date() },
          );

          // Plain JS primitives only — Auth.js v5 runs `structuredClone` on the
          // JWT payload and Mongoose's array/document classes throw DataCloneError.
          return {
            id: userDoc._id.toString(),
            email: String(userDoc.email),
            name: String(userDoc.name),
            kind: 'tenant_user' as const,
            isAdmin: Boolean(userDoc.isAdmin),
            tenantId: String(userDoc.tenantId),
            businessUnits: [...userDoc.businessUnits],
          };
        }

        // 2. Try PlatformOperator.
        // Operators share the same login page but live above the tenant boundary,
        // so they aren't found by the User query above.
        const opDoc = await PlatformOperator.findOne({ email }).select('+passwordHash');
        if (!opDoc || !opDoc.isActive) return null;
        const okOp = await verifyPassword(parsed.data.password, opDoc.passwordHash);
        if (!okOp) return null;

        await PlatformOperator.updateOne({ _id: opDoc._id }, { lastLoginAt: new Date() });

        return {
          id: opDoc._id.toString(),
          email: String(opDoc.email),
          name: String(opDoc.name),
          kind: 'operator' as const,
        };
      },
    }),
  ],
});
