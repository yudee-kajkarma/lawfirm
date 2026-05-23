'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type {
  BusinessUnitCreateInput,
  BusinessUnitUpdateInput,
} from '@/lib/utils/validators/businessUnit';
import type {
  BusinessUnit,
  BusinessUnitListFilters,
  BusinessUnitListMeta,
} from '@/types/businessUnit';

// Admin-side CRUD hooks for the `business_units` collection. Distinct from
// the `useBusinessUnit()` context hook, which exposes the BU selector state.

const KEY = ['businessUnits'] as const;

function buildQS(filters: BusinessUnitListFilters): string {
  const sp = new URLSearchParams();
  if (filters.page) sp.set('page', String(filters.page));
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (filters.search) sp.set('search', filters.search);
  if (filters.isActive) sp.set('isActive', filters.isActive);
  if (filters.sort) sp.set('sort', filters.sort);
  return sp.toString();
}

export function useBusinessUnitsList(filters: BusinessUnitListFilters) {
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async () => {
      const qs = buildQS(filters);
      const res = await apiFetch<BusinessUnit[]>(`/api/business-units${qs ? `?${qs}` : ''}`);
      return { items: res.data, meta: res.meta as BusinessUnitListMeta };
    },
  });
}

export function useBusinessUnitDetail(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<BusinessUnit>(`/api/business-units/${id}`);
      return res.data;
    },
  });
}

export function useCreateBusinessUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BusinessUnitCreateInput) => {
      const res = await apiFetch<BusinessUnit>('/api/business-units', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await qc.invalidateQueries({ queryKey: [...KEY, 'list'], refetchType: 'all' });
      return res.data;
    },
  });
}

export function useUpdateBusinessUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: BusinessUnitUpdateInput; force?: boolean }) => {
      const url = `/api/business-units/${args.id}${args.force ? '?force=true' : ''}`;
      const res = await apiFetch<BusinessUnit>(url, {
        method: 'PATCH',
        body: JSON.stringify(args.patch),
      });
      return res.data;
    },
    onSuccess: (updated) => {
      qc.setQueryData([...KEY, 'detail', updated._id], updated);
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}
