import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { auth } from '@/auth';
import { AppShell } from '@/components/layout/AppShell';
import { connectDb } from '@/lib/db/connect';
import { BusinessUnit } from '@/lib/models/BusinessUnit';

export const runtime = 'nodejs';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Middleware should already have caught this — defence in depth.
  if (!session?.user) redirect('/login');

  await connectDb();
  const all = await BusinessUnit.find({ isActive: true }).sort({ order: 1 }).lean();

  // Strip ObjectIds so the props are serializable across the server→client boundary.
  const accessible = all
    .filter((bu) => session.user.isAdmin || session.user.businessUnits.includes(bu.key))
    .map((bu) => ({
      key: bu.key,
      name: bu.name,
      color: bu.color ?? '#64748b',
    }));

  // Default BU selection: admins and multi-BU users see "all"; single-BU users
  // open straight to their one unit so the dropdown isn't misleading.
  const defaultBU = accessible.length === 1 ? accessible[0]!.key : 'all';

  return (
    <AppShell
      isAdmin={session.user.isAdmin}
      businessUnits={accessible}
      defaultBU={defaultBU}
    >
      {children}
    </AppShell>
  );
}
