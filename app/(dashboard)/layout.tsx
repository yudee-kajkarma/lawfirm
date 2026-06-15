import mongoose from 'mongoose';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { auth } from '@/auth';
import { AppShell } from '@/components/layout/AppShell';
import { NoAccessLanding } from '@/components/layout/NoAccessLanding';
import { connectDb } from '@/lib/db/connect';
import { BusinessUnit } from '@/lib/models/BusinessUnit';

export const runtime = 'nodejs';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Middleware should already have caught this — defence in depth.
  if (!session?.user) redirect('/login');

  // A missing tenantId means the JWT was issued before MT-1 (the session
  // predates multi-tenancy). Force re-login so a fresh JWT is minted.
  if (!session.user.tenantId) redirect('/login');

  await connectDb();
  const all = await BusinessUnit.find({
    tenantId: new mongoose.Types.ObjectId(session.user.tenantId),
    isActive: true,
  })
    .sort({ order: 1 })
    .lean();

  // Operators never reach this layout — the tenantId guard above redirects them.
  // Null-coalesce here is defensive typing only.
  const isAdmin = session.user.isAdmin ?? false;
  const userBUs = session.user.businessUnits ?? [];

  // Strip ObjectIds so the props are serializable across the server→client boundary.
  const accessible = all
    .filter((bu) => isAdmin || userBUs.includes(bu.key))
    .map((bu) => ({
      key: bu.key,
      name: bu.name,
      color: bu.color ?? '#64748b',
    }));

  // Non-admin with zero accessible BUs gets a dedicated landing page instead
  // of a broken-feeling shell. Happens when their BU was deactivated or their
  // BU list was emptied by an admin. They can still sign out from here.
  if (!isAdmin && accessible.length === 0) {
    return <NoAccessLanding email={session.user.email ?? ''} />;
  }

  // Default BU selection: admins and multi-BU users see "all"; single-BU users
  // open straight to their one unit so the dropdown isn't misleading.
  const defaultBU = accessible.length === 1 ? accessible[0]!.key : 'all';

  return (
    <AppShell
      isAdmin={isAdmin}
      businessUnits={accessible}
      defaultBU={defaultBU}
    >
      {children}
    </AppShell>
  );
}
