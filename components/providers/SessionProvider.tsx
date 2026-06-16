'use client';

import type { Session } from 'next-auth';
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  // Server-fetched session passed in by root layout. Hydrating with this
  // avoids the client-side /api/auth/session round trip on first render —
  // without it, useSession() returns `loading` until the fetch resolves
  // and anything gated on `user` (e.g. UserMenu) stays invisible.
  session: Session | null;
};

export function SessionProvider({ children, session }: Props) {
  return <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>;
}
