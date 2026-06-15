'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { TenantStatusGuard } from './TenantStatusGuard';

export function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser tab — Next.js may render this twice in dev, so
  // useState lazy init guarantees we don't create a fresh client per render.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {/* Redirect to /suspended if any query/mutation receives TENANT_SUSPENDED.
          Complements the server-side layout guard for in-flight requests. */}
      <TenantStatusGuard />
      {children}
    </QueryClientProvider>
  );
}
