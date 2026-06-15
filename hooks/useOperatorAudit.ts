'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type { OperatorAuditEntry } from '@/types/operator';

const KEY = ['operatorAudit'] as const;

export type OperatorAuditListFilters = {
  action?: string;
  operatorEmail?: string;
  limit?: number;
};

function buildQS(filters: OperatorAuditListFilters, cursor: string | null): string {
  const sp = new URLSearchParams();
  if (filters.action && filters.action !== 'all') sp.set('action', filters.action);
  if (filters.operatorEmail?.trim()) sp.set('operatorEmail', filters.operatorEmail.trim());
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (cursor) sp.set('cursor', cursor);
  return sp.toString();
}

export function useOperatorAuditList(filters: OperatorAuditListFilters) {
  return useInfiniteQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async ({ pageParam }) => {
      const qs = buildQS(filters, pageParam);
      const res = await apiFetch<OperatorAuditEntry[]>(
        `/api/operator/audit${qs ? `?${qs}` : ''}`,
      );
      return {
        items: res.data,
        meta: res.meta as { cursor: string | null; limit: number },
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.meta.cursor ?? undefined,
  });
}
