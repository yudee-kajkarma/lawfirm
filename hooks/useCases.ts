'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type { CaseCreateInput, CaseUpdateInput, ConvertLeadInput } from '@/lib/utils/validators/case';
import type { Case, CaseListFilters, CaseListMeta } from '@/types/case';
import type { Contact } from '@/types/contact';
import type { Lead } from '@/types/lead';

const KEY = ['cases'] as const;

function buildQS(filters: CaseListFilters): string {
  const sp = new URLSearchParams();
  if (filters.page) sp.set('page', String(filters.page));
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (filters.search) sp.set('search', filters.search);
  if (filters.status) sp.set('status', filters.status);
  if (filters.assignedTo) sp.set('assignedTo', filters.assignedTo);
  if (filters.clientId) sp.set('clientId', filters.clientId);
  if (filters.businessUnit) sp.set('businessUnit', filters.businessUnit);
  if (filters.smartListId) sp.set('smartListId', filters.smartListId);
  if (filters.sort) sp.set('sort', filters.sort);
  return sp.toString();
}

export function useCasesList(filters: CaseListFilters) {
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async () => {
      const qs = buildQS(filters);
      const res = await apiFetch<Case[]>(`/api/cases${qs ? `?${qs}` : ''}`);
      return { items: res.data, meta: res.meta as CaseListMeta };
    },
  });
}

export function useCase(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<Case>(`/api/cases/${id}`);
      return res.data;
    },
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CaseCreateInput) => {
      const res = await apiFetch<Case>('/api/cases', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      // Awaited so callers can navigate to /cases with the new row already in
      // cache. `refetchType: 'all'` also refetches unmounted listings.
      await qc.invalidateQueries({ queryKey: [...KEY, 'list'], refetchType: 'all' });
      return res.data;
    },
  });
}

export function useUpdateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: CaseUpdateInput }) => {
      const res = await apiFetch<Case>(`/api/cases/${args.id}`, {
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

export function useDeleteCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ _id: string }>(`/api/cases/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: [...KEY, 'detail', id] });
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}

export type ConversionResult = { lead: Lead; contact: Contact; case: Case };

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { leadId: string; input: ConvertLeadInput }) => {
      const res = await apiFetch<ConversionResult>(`/api/leads/${args.leadId}/convert`, {
        method: 'POST',
        body: JSON.stringify(args.input),
      });
      // Awaited refetch of every list this touches — lead is now converted,
      // a new contact exists, and a new case exists. Without this, navigating
      // back to /cases or /leads after convert shows stale data until reload.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['leads', 'list'], refetchType: 'all' }),
        qc.invalidateQueries({ queryKey: ['contacts', 'list'], refetchType: 'all' }),
        qc.invalidateQueries({ queryKey: [...KEY, 'list'], refetchType: 'all' }),
      ]);
      return res.data;
    },
    onSuccess: (result) => {
      qc.setQueryData(['leads', 'detail', result.lead._id], result.lead);
      qc.setQueryData([...KEY, 'detail', result.case._id], result.case);
    },
  });
}
