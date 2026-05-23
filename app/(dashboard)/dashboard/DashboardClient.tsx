'use client';

import { Briefcase, DollarSign, TrendingUp, UserPlus } from 'lucide-react';
import { useMemo } from 'react';

import { BreakdownCard, type BreakdownItem } from '@/components/dashboard/BreakdownCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { humanizeEnum } from '@/components/leads/LeadForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useDashboard } from '@/hooks/useDashboard';
import { CASE_STATUSES, LEAD_STAGES } from '@/lib/constants/enums';

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatPercent(n: number): string {
  return `${n}%`;
}

const STAGE_COLORS: Record<string, string> = {
  new_inquiry: '#94a3b8', // slate-400
  contacted: '#7dd3fc',   // sky-300
  qualified: '#60a5fa',   // blue-400
  proposal: '#f59e0b',    // amber-500
  negotiation: '#f97316', // orange-500
  converted: '#10b981',   // emerald-500
  lost: '#ef4444',        // red-500
};

const STATUS_COLORS: Record<string, string> = {
  open: '#60a5fa',
  in_progress: '#f59e0b',
  on_hold: '#94a3b8',
  closed: '#10b981',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  on_hold: 'On hold',
  closed: 'Closed',
};

export function DashboardClient() {
  const { currentBU } = useBusinessUnit();
  const query = useDashboard(currentBU);

  const stageItems = useMemo<BreakdownItem[]>(() => {
    if (!query.data) return [];
    return LEAD_STAGES.map((stage) => ({
      key: stage,
      label: humanizeEnum(stage),
      count: query.data!.leads.byStage[stage] ?? 0,
      color: STAGE_COLORS[stage],
    }));
  }, [query.data]);

  const statusItems = useMemo<BreakdownItem[]>(() => {
    if (!query.data) return [];
    return CASE_STATUSES.map((status) => ({
      key: status,
      label: STATUS_LABELS[status] ?? status,
      count: query.data!.cases.byStatus[status] ?? 0,
      color: STATUS_COLORS[status],
    }));
  }, [query.data]);

  if (query.isLoading) return <DashboardSkeleton />;

  if (query.isError || !query.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">
          {(query.error as Error)?.message ?? 'Failed to load metrics.'}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => query.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const m = query.data;
  const conversionInt =
    m.leads.conversionRate == null ? null : Math.round(m.leads.conversionRate * 100);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          label="Open leads"
          value={m.leads.open}
          icon={UserPlus}
          hint={`${m.leads.total} total in pipeline`}
        />
        <StatCard
          index={1}
          label="Active cases"
          value={m.cases.active}
          icon={Briefcase}
          hint={`${m.cases.total} total`}
        />
        <StatCard
          index={2}
          label="Pipeline value"
          value={m.leads.pipelineValue}
          icon={DollarSign}
          format={formatCurrency}
          hint="Open leads with a value set"
        />
        <StatCard
          index={3}
          label="Conversion rate"
          value={conversionInt}
          icon={TrendingUp}
          format={formatPercent}
          hint={
            conversionInt == null
              ? 'No converted or lost leads yet'
              : `converted ÷ (converted + lost)`
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownCard
          className="lg:col-span-2"
          title="Leads by stage"
          items={stageItems}
          emptyMessage="No leads yet. Create one from the Leads page."
        />
        <BreakdownCard
          title="Cases by status"
          items={statusItems}
          emptyMessage="No cases yet. Convert a qualified lead to open one."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Communications, document uploads, and stage changes appear here in Phase 10.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
