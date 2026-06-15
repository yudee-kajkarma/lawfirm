'use client';

import { FileCheck2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePurgeReportDetail, usePurgeReportsList } from '@/hooks/usePurgeReports';
import { cn } from '@/lib/utils';
import type { PurgeReportDetail, PurgeReportListItem } from '@/types/operator';

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ────────────────────────────────────────────────────────────────
// Main client
// ────────────────────────────────────────────────────────────────

export function PurgeReportsClient() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ search: debouncedSearch.trim() || undefined, limit: 25 }),
    [debouncedSearch],
  );

  const query = usePurgeReportsList(filters);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Purge Reports</h1>
        <p className="text-sm text-muted-foreground">
          Signed records of every completed tenant purge. HMAC integrity is verified on open.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by tenant slug…"
            className="pl-8"
          />
        </div>
      </div>

      {/* Body */}
      {query.isLoading ? (
        <TableSkeleton />
      ) : query.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{(query.error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No purge reports found"
          description={
            debouncedSearch
              ? 'Try a different tenant slug.'
              : 'Completed purges will appear here once they occur.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead className="w-[180px]">Purged at</TableHead>
                <TableHead className="w-[120px]">Triggered by</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((report) => (
                <ReportRow key={report._id} report={report} onView={setSelectedId} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Load more */}
      {items.length > 0 && (
        <div className="flex items-center justify-center pt-2">
          {query.hasNextPage ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">No more reports.</span>
          )}
        </div>
      )}

      {/* Detail sheet */}
      <ReportDetailSheet id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Row
// ────────────────────────────────────────────────────────────────

const TRIGGER_BADGE: Record<'cron' | 'operator', string> = {
  cron: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  operator: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

function ReportRow({
  report,
  onView,
}: {
  report: PurgeReportListItem;
  onView: (id: string) => void;
}) {
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell>
        <div>
          <span className="font-medium">{report.tenantName}</span>
          <code className="ml-2 font-mono text-xs text-muted-foreground">{report.tenantSlug}</code>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatTimestamp(report.purgedAt)}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn('capitalize', TRIGGER_BADGE[report.triggeredBy])}>
          {report.triggeredBy}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {report.purgedByOperatorEmail ?? '—'}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={() => onView(report._id)}>
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ────────────────────────────────────────────────────────────────
// Detail sheet
// ────────────────────────────────────────────────────────────────

function ReportDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const query = usePurgeReportDetail(id);

  return (
    <Sheet open={!!id} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Purge Report</SheetTitle>
        </SheetHeader>

        {query.isLoading ? (
          <DetailSkeleton />
        ) : query.isError ? (
          <div className="p-4 text-center">
            <p className="text-sm text-destructive">{(query.error as Error).message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
              Retry
            </Button>
          </div>
        ) : query.data ? (
          <ReportDetail report={query.data} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ReportDetail({ report }: { report: PurgeReportDetail }) {
  const initialEntries = Object.entries(report.initialDeletes);
  const verifyEntries = Object.entries(report.verification);
  const anyNonZeroVerify = verifyEntries.some(([, v]) => v !== 0);

  return (
    <div className="space-y-5 p-4">
      {/* HMAC validity — load-bearing */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold',
          report.hmacValid
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
        )}
      >
        {report.hmacValid ? 'HMAC valid ✓' : 'HMAC INVALID ✗'}
      </div>

      {/* Metadata */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Details
        </h3>
        <dl className="space-y-1 text-sm">
          <MetaRow label="Tenant" value={`${report.tenantName} (${report.tenantSlug})`} />
          <MetaRow label="Tenant ID" value={report.tenantId} mono />
          <MetaRow label="Purged at" value={formatTimestamp(report.purgedAt)} />
          <MetaRow
            label="Triggered by"
            value={
              <Badge
                variant="outline"
                className={cn('capitalize', TRIGGER_BADGE[report.triggeredBy])}
              >
                {report.triggeredBy}
              </Badge>
            }
          />
          <MetaRow label="Operator" value={report.purgedByOperatorEmail ?? '—'} />
          {report.purgedByOperatorId && (
            <MetaRow label="Operator ID" value={report.purgedByOperatorId} mono />
          )}
          <MetaRow label="HMAC algorithm" value={report.hmacAlgorithm} mono />
        </dl>
      </section>

      {/* Initial deletes */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Records deleted
        </h3>
        <CountTable entries={initialEntries} highlightNonZeroRose={false} />
      </section>

      {/* Verification counts — should all be 0 */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Verification (should all be 0)
        </h3>
        {anyNonZeroVerify && (
          <p className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
            Warning: non-zero counts indicate residual data was not purged.
          </p>
        )}
        <CountTable entries={verifyEntries} highlightNonZeroRose />
      </section>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 flex-shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('flex-1 break-all', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}

function CountTable({
  entries,
  highlightNonZeroRose,
}: {
  entries: [string, number][];
  highlightNonZeroRose: boolean;
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No data.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border text-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">
              Collection
            </th>
            <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">
              Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map(([key, count]) => (
            <tr
              key={key}
              className={cn(
                highlightNonZeroRose && count !== 0 && 'bg-rose-500/10',
              )}
            >
              <td className="px-3 py-1.5 font-mono text-xs">{key}</td>
              <td
                className={cn(
                  'px-3 py-1.5 text-right tabular-nums',
                  highlightNonZeroRose && count !== 0 && 'font-semibold text-rose-700 dark:text-rose-300',
                )}
              >
                {count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Skeletons
// ────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <div className="border-b bg-muted/20 px-4 py-3">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="ml-auto h-3 w-36" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 flex-1" />
        </div>
      ))}
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
