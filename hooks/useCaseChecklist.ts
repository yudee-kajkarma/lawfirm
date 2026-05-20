'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type {
  ChecklistCreateInput,
  ChecklistUpdateInput,
} from '@/lib/utils/validators/caseChecklist';
import type { CaseChecklistItem } from '@/types/caseChecklist';

const KEY = ['caseChecklist'] as const;

export function useCaseChecklist(caseId: string | null) {
  return useQuery({
    queryKey: [...KEY, caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const res = await apiFetch<CaseChecklistItem[]>(`/api/cases/${caseId}/checklist`);
      return res.data;
    },
  });
}

export function useCreateChecklistItem(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ChecklistCreateInput) => {
      const res = await apiFetch<CaseChecklistItem>(`/api/cases/${caseId}/checklist`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, caseId] });
    },
  });
}

export function useUpdateChecklistItem(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: ChecklistUpdateInput }) => {
      const res = await apiFetch<CaseChecklistItem>(`/api/case-checklist/${args.id}`, {
        method: 'PATCH',
        body: JSON.stringify(args.patch),
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, caseId] });
    },
  });
}

export function useDeleteChecklistItem(caseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ _id: string }>(`/api/case-checklist/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, caseId] });
    },
  });
}
