'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type { LeadCreateInput, LeadUpdateInput } from '@/lib/utils/validators/lead';
import type { Lead, LeadListFilters, LeadListMeta } from '@/types/lead';

const KEY = ['leads'] as const;

function buildQS(filters: LeadListFilters): string {
  const sp = new URLSearchParams();
  if (filters.page) sp.set('page', String(filters.page));
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (filters.search) sp.set('search', filters.search);
  if (filters.stage) sp.set('stage', filters.stage);
  if (filters.source) sp.set('source', filters.source);
  if (filters.assignedTo) sp.set('assignedTo', filters.assignedTo);
  if (filters.businessUnit) sp.set('businessUnit', filters.businessUnit);
  if (filters.smartListId) sp.set('smartListId', filters.smartListId);
  if (filters.sort) sp.set('sort', filters.sort);
  return sp.toString();
}

export function useLeadsList(filters: LeadListFilters) {
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async () => {
      const qs = buildQS(filters);
      const res = await apiFetch<Lead[]>(`/api/leads${qs ? `?${qs}` : ''}`);
      return { items: res.data, meta: res.meta as LeadListMeta };
    },
  });
}

export function useLead(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<Lead>(`/api/leads/${id}`);
      return res.data;
    },
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadCreateInput) => {
      const res = await apiFetch<Lead>('/api/leads', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      // Refetch lists (including unmounted ones) before we resolve, so callers
      // can navigate to the listing page and see the new record without
      // a manual reload. `refetchType: 'all'` is what makes unmounted queries
      // refetch — the default 'active' would mark them stale and wait until
      // they re-mount, which causes the stale-flash users were seeing.
      await qc.invalidateQueries({ queryKey: [...KEY, 'list'], refetchType: 'all' });
      return res.data;
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: LeadUpdateInput }) => {
      const res = await apiFetch<Lead>(`/api/leads/${args.id}`, {
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

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ _id: string }>(`/api/leads/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: [...KEY, 'detail', id] });
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}
