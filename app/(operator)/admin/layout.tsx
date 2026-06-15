import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { auth } from '@/auth';
import { OperatorShell } from '@/components/layout/OperatorShell';

export const runtime = 'nodejs';

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Defence-in-depth: middleware already handles this, but guard again so a
  // direct navigation can't land non-operators inside the operator shell.
  if (!session?.user || session.user.kind !== 'operator') {
    redirect('/login');
  }
  return <OperatorShell>{children}</OperatorShell>;
}
