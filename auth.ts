import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import authConfig from './auth.config';
import { verifyPassword } from '@/lib/auth/password';
import { connectDb } from '@/lib/db/connect';
import { User } from '@/lib/models/User';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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

        await connectDb();
        const userDoc = await User.findOne({ email: parsed.data.email.toLowerCase() }).select(
          '+passwordHash',
        );
        if (!userDoc || !userDoc.isActive) return null;

        const ok = await verifyPassword(parsed.data.password, userDoc.passwordHash);
        if (!ok) return null;

        // Bump last-login. Use findByIdAndUpdate (not .save()) so we skip both
        // audit-log entries and the audit-fields `updatedBy` hook — this isn't
        // a user-driven mutation worth tracking.
        await User.findByIdAndUpdate(userDoc._id, { lastLoginAt: new Date() });

        // Plain JS primitives only — Auth.js v5 runs `structuredClone` on the
        // JWT payload and Mongoose's array/document classes throw DataCloneError.
        return {
          id: userDoc._id.toString(),
          email: String(userDoc.email),
          name: String(userDoc.name),
          isAdmin: Boolean(userDoc.isAdmin),
          businessUnits: [...userDoc.businessUnits],
        };
      },
    }),
  ],
});
