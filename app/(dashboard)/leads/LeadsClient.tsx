'use client';

import { Plus, Search, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { humanizeEnum } from '@/components/leads/LeadForm';
import { EmptyState } from '@/components/shared/EmptyState';
import { SmartListPicker } from '@/components/smart-lists/SmartListPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLeadsList } from '@/hooks/useLeads';
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  type LeadSource,
  type LeadStage,
} from '@/lib/constants/enums';
import { cn } from '@/lib/utils';
import type { Lead } from '@/types/lead';

const PAGE_SIZE = 25;

// Stage→badge variant. shadcn Badge has 4 variants; we add per-stage tints
// inline for the qualitative ones we want to set apart (converted = green,
// proposal/negotiation = warm).
const STAGE_STYLES: Record<
  LeadStage,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  new_inquiry: { variant: 'outline' },
  contacted: { variant: 'secondary' },
  qualified: { variant: 'default' },
  proposal: {
    variant: 'outline',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  negotiation: {
    variant: 'outline',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  converted: {
    variant: 'outline',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  lost: { variant: 'destructive' },
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  const s = STAGE_STYLES[stage];
  return (
    <Badge variant={s.variant} className={cn('whitespace-nowrap', s.className)}>
      {humanizeEnum(stage)}
    </Badge>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatValue(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function LeadsClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { currentBU, businessUnits } = useBusinessUnit();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | LeadSource>('all');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);
  const smartListId = sp.get('smartListId') ?? undefined;

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      stage: stageFilter === 'all' ? undefined : stageFilter,
      source: sourceFilter === 'all' ? undefined : sourceFilter,
      businessUnit: currentBU !== 'all' ? currentBU : undefined,
      smartListId,
    }),
    [page, debouncedSearch, stageFilter, sourceFilter, currentBU, smartListId],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stageFilter, sourceFilter, currentBU, smartListId]);

  const query = useLeadsList(filters);

  const buColor = (key: string) => businessUnits.find((bu) => bu.key === key)?.color ?? '#64748b';
  const buName = (key: string) => businessUnits.find((bu) => bu.key === key)?.name ?? key;

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(debouncedSearch) || stageFilter !== 'all' || sourceFilter !== 'all';

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, company…"
              className="pl-8"
            />
          </div>
          <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as typeof stageFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {LEAD_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {humanizeEnum(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SmartListPicker entity="lead" />
          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {humanizeEnum(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/leads/new">
            <Plus className="size-4" />
            New lead
          </Link>
        </Button>
      </div>

      {query.isLoading ? (
        <TableSkeleton />
      ) : query.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{(query.error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={filtersActive ? 'No matching leads' : 'No leads yet'}
          description={
            filtersActive
              ? 'Try clearing your filters or searching for something different.'
              : 'Capture your first lead to start tracking it through the pipeline.'
          }
          action={
            !filtersActive ? (
              <Button asChild size="sm" className="gap-2">
                <Link href="/leads/new">
                  <Plus className="size-4" />
                  New lead
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[140px]">Stage</TableHead>
                <TableHead className="w-[140px]">Source</TableHead>
                <TableHead className="w-[160px]">Business unit</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="w-[110px] text-right">Value</TableHead>
                <TableHead className="w-[130px]">Close date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data!.items.map((l) => (
                <LeadRow
                  key={l._id}
                  lead={l}
                  buColor={buColor(l.businessUnit)}
                  buName={buName(l.businessUnit)}
                  onClick={() => router.push(`/leads/${l._id}`)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || query.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadRow({
  lead,
  buColor,
  buName,
  onClick,
}: {
  lead: Lead;
  buColor: string;
  buName: string;
  onClick: () => void;
}) {
  return (
    <TableRow
      onClick={onClick}
      className="cursor-pointer hover:bg-muted/40"
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
    >
      <TableCell className="font-medium">
        {lead.firstName} {lead.lastName}
      </TableCell>
      <TableCell>
        <StageBadge stage={lead.stage} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {humanizeEnum(lead.source)}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="inline-block size-2 rounded-full" style={{ backgroundColor: buColor }} />
          <span>{buName}</span>
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{lead.companyName ?? '—'}</TableCell>
      <TableCell className="text-right text-sm tabular-nums">{formatValue(lead.value)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : '—'}
      </TableCell>
    </TableRow>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <div className="border-b bg-muted/20 px-4 py-3">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
