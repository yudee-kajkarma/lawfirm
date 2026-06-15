'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Listens to TanStack Query cache events. Whenever a query or mutation fails
 * with a TENANT_SUSPENDED error code (defined by withAuth.ts), push the user
 * to /suspended. Complements the server-side layout guard so an in-flight
 * page that started loading BEFORE the suspension still routes the user
 * cleanly when the API responds 403 TENANT_SUSPENDED.
 *
 * Returns null — this is a behaviour-only component with no rendered output.
 * Mount it once at the QueryClientProvider level so it catches errors from
 * any query or mutation anywhere in the app.
 */
export function TenantStatusGuard() {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    const cache = qc.getQueryCache();
    const mutationCache = qc.getMutationCache();

    // apiFetch throws ApiError with .code set to the API envelope's error.code.
    // For suspended tenants, withAuth returns code 'TENANT_SUSPENDED'. We also
    // guard the message string as a belt-and-braces fallback in case a future
    // path returns a plain Error rather than an ApiError.
    function check(err: unknown): void {
      if (!(err instanceof Error)) return;
      const asAny = err as { code?: string };
      if (
        asAny.code === 'TENANT_SUSPENDED' ||
        err.message.includes('TENANT_SUSPENDED') ||
        err.message.toLowerCase().includes('suspended')
      ) {
        router.replace('/suspended');
      }
    }

    const unsubQ = cache.subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') {
        check(event.action.error);
      }
    });
    const unsubM = mutationCache.subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') {
        check(event.action.error);
      }
    });

    return () => {
      unsubQ();
      unsubM();
    };
  }, [qc, router]);

  return null;
}
