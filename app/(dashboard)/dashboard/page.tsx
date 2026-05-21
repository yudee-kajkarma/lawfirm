import { auth } from '@/auth';

import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const session = await auth();
  const firstName = (session?.user.name ?? 'there').split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your CRM at a glance.</p>
      </div>
      <DashboardClient />
    </div>
  );
}
