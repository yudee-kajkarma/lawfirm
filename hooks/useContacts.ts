'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type {
  ContactCreateInput,
  ContactUpdateInput,
} from '@/lib/utils/validators/contact';
import type { Contact, ContactListFilters, ContactListMeta } from '@/types/contact';

const KEY = ['contacts'] as const;

function buildQS(filters: ContactListFilters): string {
  const sp = new URLSearchParams();
  if (filters.page) sp.set('page', String(filters.page));
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (filters.search) sp.set('search', filters.search);
  if (filters.contactType) sp.set('contactType', filters.contactType);
  if (filters.businessUnit) sp.set('businessUnit', filters.businessUnit);
  if (filters.sort) sp.set('sort', filters.sort);
  return sp.toString();
}

export function useContactsList(filters: ContactListFilters) {
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async () => {
      const qs = buildQS(filters);
      const res = await apiFetch<Contact[]>(`/api/contacts${qs ? `?${qs}` : ''}`);
      return { items: res.data, meta: res.meta as ContactListMeta };
    },
  });
}

export function useContact(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<Contact>(`/api/contacts/${id}`);
      return res.data;
    },
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactCreateInput) => {
      const res = await apiFetch<Contact>('/api/contacts', {
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

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: ContactUpdateInput }) => {
      const res = await apiFetch<Contact>(`/api/contacts/${args.id}`, {
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

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ _id: string }>(`/api/contacts/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: [...KEY, 'detail', id] });
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}
