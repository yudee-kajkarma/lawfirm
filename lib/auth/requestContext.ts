import { AsyncLocalStorage } from 'node:async_hooks';

import type { AuditSource } from '../constants/enums';

export type RequestUser = {
  _id: string;
  email: string;
  isAdmin: boolean;
  businessUnits: string[];
};

export type RequestContext = {
  user: RequestUser | null;
  source: AuditSource;
  ip?: string;
  userAgent?: string;
};

/**
 * Pin the AsyncLocalStorage instance on globalThis. In Next.js dev mode, HMR
 * can reload this module after a code save; without this pin, `withAuth.ts`
 * would write context into a new storage instance while the cached plugin
 * imports keep reading from the old one — silently dropping actor info on
 * every audited save (see audit log entries with `actorId: null` post-HMR).
 *
 * Same pattern as the Mongoose connection cache in `lib/db/connect.ts`.
 */
declare global {
  // eslint-disable-next-line no-var
  var __requestContextStorage__: AsyncLocalStorage<RequestContext> | undefined;
}

const storage: AsyncLocalStorage<RequestContext> =
  globalThis.__requestContextStorage__ ??
  (globalThis.__requestContextStorage__ = new AsyncLocalStorage<RequestContext>());

export function runWithContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}
