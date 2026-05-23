'use client';

import { Building2, History, Plug, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/settings/users', label: 'Users', icon: Users },
  { href: '/settings/business-units', label: 'Business units', icon: Building2 },
  { href: '/settings/audit-log', label: 'Audit log', icon: History },
  { href: '/settings/integrations', label: 'Integrations', icon: Plug },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-card/40">
      <ul className="flex items-center gap-1 overflow-x-auto px-6">
        {ITEMS.map((item) => {
          // Active if the current path starts with the item href. We treat
          // /settings/users/new as still being on the Users tab.
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
