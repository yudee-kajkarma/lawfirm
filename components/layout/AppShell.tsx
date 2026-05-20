'use client';

import type { ReactNode } from 'react';

import { BusinessUnitProvider, type BU } from '@/components/providers/BusinessUnitProvider';

import { Header } from './Header';
import { Sidebar } from './Sidebar';

type Props = {
  children: ReactNode;
  isAdmin: boolean;
  businessUnits: BU[];
  defaultBU: string;
};

export function AppShell({ children, isAdmin, businessUnits, defaultBU }: Props) {
  return (
    <BusinessUnitProvider businessUnits={businessUnits} defaultBU={defaultBU}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar isAdmin={isAdmin} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </BusinessUnitProvider>
  );
}
