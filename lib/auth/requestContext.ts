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

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}
