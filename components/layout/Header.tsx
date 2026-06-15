'use client';

import { usePathname } from 'next/navigation';

import { BUSelector } from './BUSelector';
import { UserMenu } from './UserMenu';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leads': 'Leads',
  '/pipeline': 'Pipeline',
  '/contacts': 'Contacts',
  '/cases': 'Cases',
  '/tasks': 'Tasks',
  '/calendar': 'Calendar',
  '/communications': 'Communications',
  '/documents': 'Documents',
  '/invoices': 'Invoices',
  '/smart-lists': 'Smart Lists',
  '/settings': 'Settings',
  '/settings/users': 'Settings · Users',
  '/settings/business-units': 'Settings · Business units',
  '/settings/audit-log': 'Settings · Audit log',
  '/settings/integrations': 'Settings · Integrations',
  '/admin/tenants': 'Tenants',
  '/admin/audit': 'Operator Audit',
};

function titleFromPath(pathname: string): string {
  // Exact match first; then prefix match for detail/sub pages
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [key, value] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(`${key}/`)) return value;
  }
  return '';
}

export function Header() {
  const pathname = usePathname();
  const title = titleFromPath(pathname);

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        <BUSelector />
        <UserMenu />
      </div>
    </header>
  );
}
