'use client';

import type { ReactNode } from 'react';

import { BusinessUnitProvider } from '@/components/providers/BusinessUnitProvider';

import { Header } from './Header';
import { OperatorSidebar } from './OperatorSidebar';

type Props = { children: ReactNode };

/**
 * Operator shell — no BU selector logic, but wrapped in BusinessUnitProvider
 * with an empty BU list so the existing Header component (which reads the BU
 * context for its BUSelector dropdown) doesn't throw. The dropdown renders with
 * no BU items — only the "All business units" entry — which is harmless for
 * operators.
 */
export function OperatorShell({ children }: Props) {
  return (
    <BusinessUnitProvider businessUnits={[]} defaultBU="all">
      <div className="flex h-screen overflow-hidden bg-background">
        <OperatorSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </BusinessUnitProvider>
  );
}
