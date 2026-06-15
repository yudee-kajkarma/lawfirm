'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type { OperatorTenantDetail, OperatorTenantListItem } from '@/types/operator';

const KEY = ['operatorTenants'] as const;

export type OperatorTenantsListFilters = {
  status?: string;
  search?: string;
  limit?: number;
};

function buildQS(filters: OperatorTenantsListFilters, cursor: string | null): string {
  const sp = new URLSearchParams();
  if (filters.status && filters.status !== 'all') sp.set('status', filters.status);
  if (filters.search?.trim()) sp.set('search', filters.search.trim());
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (cursor) sp.set('cursor', cursor);
  return sp.toString();
}

export function useOperatorTenantsList(filters: OperatorTenantsListFilters) {
  return useInfiniteQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async ({ pageParam }) => {
      const qs = buildQS(filters, pageParam);
      const res = await apiFetch<OperatorTenantListItem[]>(
        `/api/operator/tenants${qs ? `?${qs}` : ''}`,
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

export function useOperatorTenant(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<OperatorTenantDetail>(`/api/operator/tenants/${id}`);
      return res.data;
    },
  });
}

export function useSuspendTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiFetch<{ _id: string; status: string }>(
        `/api/operator/tenants/${tenantId}/suspend`,
        { method: 'POST' },
      );
      // Refresh both list and detail so the UI reflects the new status.
      await qc.invalidateQueries({ queryKey: KEY, refetchType: 'all' });
      return res.data;
    },
  });
}

export function useReactivateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiFetch<{ _id: string; status: string }>(
        `/api/operator/tenants/${tenantId}/reactivate`,
        { method: 'POST' },
      );
      await qc.invalidateQueries({ queryKey: KEY, refetchType: 'all' });
      return res.data;
    },
  });
}

export function useSchedulePurge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiFetch<{ _id: string; status: string }>(
        `/api/operator/tenants/${tenantId}/schedule-purge`,
        { method: 'POST' },
      );
      await qc.invalidateQueries({ queryKey: KEY, refetchType: 'all' });
      return res.data;
    },
  });
}

export function useCancelPurge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiFetch<{ _id: string; status: string }>(
        `/api/operator/tenants/${tenantId}/cancel-purge`,
        { method: 'POST' },
      );
      await qc.invalidateQueries({ queryKey: KEY, refetchType: 'all' });
      return res.data;
    },
  });
}
