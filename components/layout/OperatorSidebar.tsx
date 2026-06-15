'use client';

import { Building2, FileCheck2, ScrollText, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { href: '/admin/purge-reports', label: 'Purge Reports', icon: FileCheck2 },
  { href: '/admin/audit', label: 'Audit', icon: ScrollText },
];

export function OperatorSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <span className="text-sm font-bold">IP</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-sidebar-foreground">InstaPath</span>
          <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
            Operator
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>
    </aside>
  );
}

function SidebarItem({ href, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId="operator-sidebar-active-pill"
          className="absolute inset-0 -z-0 rounded-md bg-sidebar-accent"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <Icon className="relative z-10 size-4 text-sidebar-primary" />
      <span className="relative z-10">{label}</span>
    </Link>
  );
}
