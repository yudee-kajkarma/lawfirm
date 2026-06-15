'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type { PurgeReportDetail, PurgeReportListItem } from '@/types/operator';

const KEY = ['purgeReports'] as const;

export type PurgeReportListFilters = {
  search?: string;
  limit?: number;
};

function buildQS(filters: PurgeReportListFilters, cursor: string | null): string {
  const sp = new URLSearchParams();
  if (filters.search?.trim()) sp.set('search', filters.search.trim());
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (cursor) sp.set('cursor', cursor);
  return sp.toString();
}

export function usePurgeReportsList(filters: PurgeReportListFilters) {
  return useInfiniteQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async ({ pageParam }) => {
      const qs = buildQS(filters, pageParam);
      const res = await apiFetch<PurgeReportListItem[]>(
        `/api/operator/purge-reports${qs ? `?${qs}` : ''}`,
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

export function usePurgeReportDetail(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<PurgeReportDetail>(`/api/operator/purge-reports/${id}`);
      return res.data;
    },
  });
}
