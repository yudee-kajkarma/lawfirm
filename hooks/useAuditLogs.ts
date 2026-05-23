'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type { AuditLog, AuditLogListFilters, AuditLogListMeta } from '@/types/auditLog';

const KEY = ['auditLogs'] as const;

function buildQS(filters: AuditLogListFilters, cursor: string | null): string {
  const sp = new URLSearchParams();
  if (filters.collectionName) sp.set('collectionName', filters.collectionName);
  if (filters.action) sp.set('action', filters.action);
  if (filters.source) sp.set('source', filters.source);
  if (filters.businessUnit) sp.set('businessUnit', filters.businessUnit);
  if (filters.actorEmail) sp.set('actorEmail', filters.actorEmail);
  if (filters.from) sp.set('from', filters.from);
  if (filters.to) sp.set('to', filters.to);
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (cursor) sp.set('cursor', cursor);
  return sp.toString();
}

export function useAuditLogsList(filters: AuditLogListFilters) {
  return useInfiniteQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async ({ pageParam }) => {
      const qs = buildQS(filters, pageParam);
      const res = await apiFetch<AuditLog[]>(`/api/audit-logs${qs ? `?${qs}` : ''}`);
      return { items: res.data, meta: res.meta as AuditLogListMeta };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.meta.cursor ?? undefined,
  });
}
