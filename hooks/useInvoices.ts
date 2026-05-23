'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type {
  InvoiceCreateInput,
  InvoiceUpdateInput,
} from '@/lib/utils/validators/invoice';
import type { Invoice, InvoiceListFilters, InvoiceListMeta } from '@/types/invoice';

const KEY = ['invoices'] as const;

function buildQS(filters: InvoiceListFilters): string {
  const sp = new URLSearchParams();
  if (filters.page) sp.set('page', String(filters.page));
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (filters.search) sp.set('search', filters.search);
  if (filters.status) sp.set('status', filters.status);
  if (filters.clientId) sp.set('clientId', filters.clientId);
  if (filters.caseId) sp.set('caseId', filters.caseId);
  if (filters.businessUnit) sp.set('businessUnit', filters.businessUnit);
  if (filters.sort) sp.set('sort', filters.sort);
  return sp.toString();
}

export function useInvoicesList(filters: InvoiceListFilters) {
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async () => {
      const qs = buildQS(filters);
      const res = await apiFetch<Invoice[]>(`/api/invoices${qs ? `?${qs}` : ''}`);
      return { items: res.data, meta: res.meta as InvoiceListMeta };
    },
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<Invoice>(`/api/invoices/${id}`);
      return res.data;
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InvoiceCreateInput) => {
      const res = await apiFetch<Invoice>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      // Awaited so callers can navigate to /invoices with the new row in
      // cache. `refetchType: 'all'` also refetches unmounted listings.
      await qc.invalidateQueries({ queryKey: [...KEY, 'list'], refetchType: 'all' });
      return res.data;
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: InvoiceUpdateInput }) => {
      const res = await apiFetch<Invoice>(`/api/invoices/${args.id}`, {
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

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ _id: string }>(`/api/invoices/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: [...KEY, 'detail', id] });
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}

function makeAction(action: 'send' | 'mark-paid' | 'void') {
  return function useAction() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const res = await apiFetch<Invoice>(`/api/invoices/${id}/${action}`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        return res.data;
      },
      onSuccess: (updated) => {
        qc.setQueryData([...KEY, 'detail', updated._id], updated);
        qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
      },
    });
  };
}

export const useSendInvoice = makeAction('send');
export const useMarkInvoicePaid = makeAction('mark-paid');
export const useVoidInvoice = makeAction('void');
