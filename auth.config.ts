import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js config — imported by middleware.ts (runs on edge runtime).
 * No Node-only deps allowed here (no Mongoose, no bcrypt). The Credentials
 * provider lives in `auth.ts` since `authorize` needs both.
 */
const authConfig: NextAuthConfig = {
  // Auth.js v5 beta no longer auto-falls-back to NEXTAUTH_SECRET — resolve
  // explicitly so either env var name works.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  // Needed for non-Vercel deploys; harmless on Vercel. With this on, Auth.js
  // trusts the Host header from the proxy.
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only populated on first sign-in (right after authorize).
      if (user) {
        const kind = user.kind ?? 'tenant_user';
        token.kind = kind;
        if (user.email) token.email = user.email;
        if (user.name) token.name = user.name;
        if (kind === 'tenant_user') {
          token.isAdmin = Boolean(user.isAdmin);
          token.tenantId = typeof user.tenantId === 'string' ? user.tenantId : '';
          // Defensive spread — even if authorize returns a non-plain array, this
          // normalizes to one so structuredClone in jose's JWT encode succeeds.
          token.businessUnits = Array.isArray(user.businessUnits) ? [...user.businessUnits] : [];
        } else {
          // Operators carry no tenant-scoped claims — strip them so they cannot
          // accidentally be mistaken for a tenant user by downstream code.
          delete token.isAdmin;
          delete token.tenantId;
          delete token.businessUnits;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.kind = (token.kind as 'tenant_user' | 'operator') ?? 'tenant_user';
      if (typeof token.email === 'string') session.user.email = token.email;
      if (typeof token.name === 'string') session.user.name = token.name;
      if (session.user.kind === 'tenant_user') {
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.tenantId = typeof token.tenantId === 'string' ? token.tenantId : '';
        session.user.businessUnits = Array.isArray(token.businessUnits)
          ? (token.businessUnits as string[])
          : [];
      } else {
        // Operators: explicitly unset tenant fields so session consumers can't
        // accidentally read stale values from a previous kind='tenant_user' token.
        session.user.isAdmin = undefined;
        session.user.tenantId = undefined;
        session.user.businessUnits = undefined;
      }
      return session;
    },
  },
};

export default authConfig;
