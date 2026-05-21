'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type {
  SmartListCreateInput,
  SmartListUpdateInput,
} from '@/lib/utils/validators/smartList';
import type { SmartList, SmartListListFilters } from '@/types/smartList';

const KEY = ['smartLists'] as const;

function buildQS(filters: SmartListListFilters): string {
  const sp = new URLSearchParams();
  if (filters.entity) sp.set('entity', filters.entity);
  if (filters.businessUnit) sp.set('businessUnit', filters.businessUnit);
  return sp.toString();
}

export function useSmartLists(filters: SmartListListFilters = {}) {
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async () => {
      const qs = buildQS(filters);
      const res = await apiFetch<SmartList[]>(`/api/smart-lists${qs ? `?${qs}` : ''}`);
      return res.data;
    },
  });
}

export function useSmartList(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<SmartList>(`/api/smart-lists/${id}`);
      return res.data;
    },
  });
}

export function useCreateSmartList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SmartListCreateInput) => {
      const res = await apiFetch<SmartList>('/api/smart-lists', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}

export function useUpdateSmartList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: SmartListUpdateInput }) => {
      const res = await apiFetch<SmartList>(`/api/smart-lists/${args.id}`, {
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

export function useDeleteSmartList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ _id: string }>(`/api/smart-lists/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: [...KEY, 'detail', id] });
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}
