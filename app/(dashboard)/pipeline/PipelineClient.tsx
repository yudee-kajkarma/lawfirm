'use client';

import { Briefcase, Kanban, UserPlus } from 'lucide-react';
import { useMemo } from 'react';

import { CaseBoard } from '@/components/pipeline/CaseBoard';
import { PipelineBoard } from '@/components/pipeline/PipelineBoard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useCasesList } from '@/hooks/useCases';
import { useLeadsList } from '@/hooks/useLeads';
import type { CaseListFilters } from '@/types/case';
import type { LeadListFilters } from '@/types/lead';

// Pipeline view shows up to this many records per tab. Larger BUs will need
// stage-level pagination / virtualization later — fine for now.
const PIPELINE_LIMIT = 100;

export function PipelineClient() {
  const { currentBU } = useBusinessUnit();

  const leadsFilters = useMemo<LeadListFilters>(() => {
    const f: LeadListFilters = { limit: PIPELINE_LIMIT };
    if (currentBU !== 'all') f.businessUnit = currentBU;
    return f;
  }, [currentBU]);

  const casesFilters = useMemo<CaseListFilters>(() => {
    const f: CaseListFilters = { limit: PIPELINE_LIMIT };
    if (currentBU !== 'all') f.businessUnit = currentBU;
    return f;
  }, [currentBU]);

  return (
    <div className="space-y-3 p-6">
      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads" className="gap-2">
            <UserPlus className="size-3.5" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="cases" className="gap-2">
            <Briefcase className="size-3.5" />
            Cases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <LeadsPanel filters={leadsFilters} />
        </TabsContent>

        <TabsContent value="cases" className="mt-4">
          <CasesPanel filters={casesFilters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeadsPanel({ filters }: { filters: LeadListFilters }) {
  const query = useLeadsList(filters);

  if (query.isLoading) return <BoardSkeleton />;
  if (query.isError)
    return (
      <BoardError
        message={(query.error as Error).message}
        onRetry={() => query.refetch()}
      />
    );

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Kanban}
        title="No leads to triage"
        description="Create leads from the Leads page — they'll show up here so you can drag them across pipeline stages."
      />
    );
  }

  const truncated = (query.data?.meta.total ?? 0) > items.length;
  return (
    <div className="space-y-2">
      {truncated && (
        <p className="text-xs text-muted-foreground">
          Showing the first {PIPELINE_LIMIT} leads. Use the Leads list for a full view.
        </p>
      )}
      <PipelineBoard filters={filters} leads={items} />
    </div>
  );
}

function CasesPanel({ filters }: { filters: CaseListFilters }) {
  const query = useCasesList(filters);

  if (query.isLoading) return <BoardSkeleton />;
  if (query.isError)
    return (
      <BoardError
        message={(query.error as Error).message}
        onRetry={() => query.refetch()}
      />
    );

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Kanban}
        title="No cases yet"
        description="Convert a qualified lead to open your first case. It'll appear here in the Open column."
      />
    );
  }

  const truncated = (query.data?.meta.total ?? 0) > items.length;
  return (
    <div className="space-y-2">
      {truncated && (
        <p className="text-xs text-muted-foreground">
          Showing the first {PIPELINE_LIMIT} cases. Use the Cases list for a full view.
        </p>
      )}
      <CaseBoard filters={filters} cases={items} />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[calc(100vh-12rem)] w-72 flex-shrink-0" />
      ))}
    </div>
  );
}

function BoardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
