'use client';

import { useSession } from 'next-auth/react';
import { useCallback } from 'react';

export function useCurrentUser() {
  const { data: session, status } = useSession();
  const user = session?.user ?? null;

  const canAccessBU = useCallback(
    (bu: string) => {
      if (!user) return false;
      if (user.isAdmin) return true;
      // businessUnits is optional since operators don't carry BU claims.
      return (user.businessUnits ?? []).includes(bu);
    },
    [user],
  );

  return {
    user,
    isLoading: status === 'loading',
    isAuthed: status === 'authenticated',
    isAdmin: user?.isAdmin ?? false,
    businessUnits: user?.businessUnits ?? [],
    canAccessBU,
  };
}
