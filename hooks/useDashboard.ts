'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/utils/apiFetch';
import type { DashboardMetrics } from '@/types/dashboard';

export function useDashboard(businessUnit: string) {
  return useQuery({
    queryKey: ['dashboard', businessUnit],
    queryFn: async () => {
      const qs = businessUnit && businessUnit !== 'all' ? `?businessUnit=${businessUnit}` : '';
      const res = await apiFetch<DashboardMetrics>(`/api/dashboard${qs}`);
      return res.data;
    },
    // Refresh every 60s so the dashboard reflects newly-created records
    // without forcing a full page reload.
    refetchInterval: 60_000,
  });
}
