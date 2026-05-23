import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { auth } from '@/auth';
import { SettingsNav } from '@/components/settings/SettingsNav';

export const runtime = 'nodejs';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  // Defence in depth — middleware already blocks non-admins from /settings/*,
  // but server components should still verify the session directly.
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!session.user.isAdmin) redirect('/dashboard');

  return (
    <div>
      <div className="px-6 pb-2 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who can access the CRM, your business units, and the audit trail.
        </p>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
