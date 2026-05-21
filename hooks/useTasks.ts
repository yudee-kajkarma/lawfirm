'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type {
  TaskCreateInput,
  TaskUpdateInput,
} from '@/lib/utils/validators/task';
import type { Task, TaskListFilters, TaskListMeta } from '@/types/task';

const KEY = ['tasks'] as const;

function buildQS(filters: TaskListFilters): string {
  const sp = new URLSearchParams();
  if (filters.page) sp.set('page', String(filters.page));
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (filters.search) sp.set('search', filters.search);
  if (filters.status) sp.set('status', filters.status);
  if (filters.priority) sp.set('priority', filters.priority);
  if (filters.assignedTo) sp.set('assignedTo', filters.assignedTo);
  if (filters.businessUnit) sp.set('businessUnit', filters.businessUnit);
  if (filters.smartListId) sp.set('smartListId', filters.smartListId);
  if (filters.relatedToType) sp.set('relatedToType', filters.relatedToType);
  if (filters.relatedToId) sp.set('relatedToId', filters.relatedToId);
  if (filters.overdue) sp.set('overdue', 'true');
  if (filters.sort) sp.set('sort', filters.sort);
  return sp.toString();
}

export function useTasksList(filters: TaskListFilters) {
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async () => {
      const qs = buildQS(filters);
      const res = await apiFetch<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`);
      return { items: res.data, meta: res.meta as TaskListMeta };
    },
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<Task>(`/api/tasks/${id}`);
      return res.data;
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskCreateInput) => {
      const res = await apiFetch<Task>('/api/tasks', {
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

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: TaskUpdateInput }) => {
      const res = await apiFetch<Task>(`/api/tasks/${args.id}`, {
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

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ _id: string }>(`/api/tasks/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: [...KEY, 'detail', id] });
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}
