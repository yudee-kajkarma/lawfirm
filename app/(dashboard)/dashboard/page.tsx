import { Briefcase, FileText, UserPlus, Users } from 'lucide-react';

import { auth } from '@/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PLACEHOLDER_STATS = [
  { label: 'Open leads', value: '—', icon: UserPlus, hint: 'arrives in Phase 4' },
  { label: 'Active cases', value: '—', icon: Briefcase, hint: 'arrives in Phase 4' },
  { label: 'Contacts', value: '—', icon: Users, hint: 'arrives in Phase 4' },
  { label: 'Documents', value: '—', icon: FileText, hint: 'arrives in Phase 4' },
];

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? 'there';
  const firstName = name.split(' ')[0] ?? name;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Phase 0e shell is live. Real metrics, smart filters, and recent activity arrive in
          Phase 4.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_STATS.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  {stat.label}
                </CardDescription>
                <stat.icon className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phase 0e checklist</CardTitle>
          <CardDescription>
            The sidebar, header, BU selector, and avatar menu are now live. Try them out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>Click around the sidebar — the active pill slides between routes.</li>
            <li>Open the BU dropdown — your selection persists across refreshes.</li>
            <li>Click your avatar → Sign out to test the logout flow.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
