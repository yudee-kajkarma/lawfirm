'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type {
  UserCreateInput,
  UserPasswordInput,
  UserUpdateInput,
} from '@/lib/utils/validators/user';
import type { User, UserListFilters, UserListMeta } from '@/types/user';

const KEY = ['users'] as const;

function buildQS(filters: UserListFilters): string {
  const sp = new URLSearchParams();
  if (filters.page) sp.set('page', String(filters.page));
  if (filters.limit) sp.set('limit', String(filters.limit));
  if (filters.search) sp.set('search', filters.search);
  if (filters.isActive) sp.set('isActive', filters.isActive);
  if (filters.isAdmin !== undefined) sp.set('isAdmin', String(filters.isAdmin));
  if (filters.businessUnit) sp.set('businessUnit', filters.businessUnit);
  if (filters.sort) sp.set('sort', filters.sort);
  return sp.toString();
}

export function useUsersList(filters: UserListFilters) {
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    queryFn: async () => {
      const qs = buildQS(filters);
      const res = await apiFetch<User[]>(`/api/users${qs ? `?${qs}` : ''}`);
      return { items: res.data, meta: res.meta as UserListMeta };
    },
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<User>(`/api/users/${id}`);
      return res.data;
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UserCreateInput) => {
      const res = await apiFetch<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await qc.invalidateQueries({ queryKey: [...KEY, 'list'], refetchType: 'all' });
      return res.data;
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: UserUpdateInput }) => {
      const res = await apiFetch<User>(`/api/users/${args.id}`, {
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

export function useSetUserPassword() {
  return useMutation({
    mutationFn: async (args: { id: string; password: string }) => {
      const input: UserPasswordInput = { password: args.password };
      await apiFetch<{ _id: string }>(`/api/users/${args.id}/password`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return args.id;
    },
  });
}
