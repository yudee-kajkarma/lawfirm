'use client';

import { Briefcase, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { CaseStatusBadge } from '@/components/cases/CaseStatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { SmartListPicker } from '@/components/smart-lists/SmartListPicker';
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
import { useCasesList } from '@/hooks/useCases';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CASE_STATUSES, type CaseStatus } from '@/lib/constants/enums';
import type { Case } from '@/types/case';

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  on_hold: 'On hold',
  closed: 'Closed',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
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

export function CasesClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { currentBU, businessUnits } = useBusinessUnit();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);
  const smartListId = sp.get('smartListId') ?? undefined;

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      businessUnit: currentBU !== 'all' ? currentBU : undefined,
      smartListId,
    }),
    [page, debouncedSearch, statusFilter, currentBU, smartListId],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, currentBU, smartListId]);

  const query = useCasesList(filters);

  const buColor = (key: string) => businessUnits.find((bu) => bu.key === key)?.color ?? '#64748b';
  const buName = (key: string) => businessUnits.find((bu) => bu.key === key)?.name ?? key;

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(debouncedSearch) || statusFilter !== 'all';

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search case number, title…"
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CASE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SmartListPicker entity="case" />
        </div>
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
          icon={Briefcase}
          title={filtersActive ? 'No matching cases' : 'No cases yet'}
          description={
            filtersActive
              ? 'Try clearing your filters.'
              : 'Convert a qualified lead from the Leads page to open your first case.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Case #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead className="w-[160px]">Business unit</TableHead>
                <TableHead className="w-[120px] text-right">Value</TableHead>
                <TableHead className="w-[120px]">Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data!.items.map((c) => (
                <CaseRow
                  key={c._id}
                  caseDoc={c}
                  buColor={buColor(c.businessUnit)}
                  buName={buName(c.businessUnit)}
                  onClick={() => router.push(`/cases/${c._id}`)}
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

function CaseRow({
  caseDoc,
  buColor,
  buName,
  onClick,
}: {
  caseDoc: Case;
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
      <TableCell className="font-mono text-xs">{caseDoc.caseNumber}</TableCell>
      <TableCell className="font-medium">{caseDoc.title}</TableCell>
      <TableCell>
        <CaseStatusBadge status={caseDoc.status} />
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="inline-block size-2 rounded-full" style={{ backgroundColor: buColor }} />
          <span>{buName}</span>
        </span>
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">{formatValue(caseDoc.value)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDate(caseDoc.openedAt)}</TableCell>
    </TableRow>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b bg-muted/20 px-4 py-3">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
