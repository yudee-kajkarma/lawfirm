'use client';

import { Plus, Receipt, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { formatCurrency, formatDate } from '@/components/invoices/format';
import { EmptyState } from '@/components/shared/EmptyState';
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
import { useInvoicesList } from '@/hooks/useInvoices';
import { INVOICE_STATUSES, type InvoiceStatus } from '@/lib/constants/enums';
import { cn } from '@/lib/utils';
import type { Invoice } from '@/types/invoice';

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

export function InvoicesClient() {
  const router = useRouter();
  const { currentBU, businessUnits } = useBusinessUnit();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      // "overdue" isn't a persisted status (it's computed) — filter by the
      // underlying `sent` and let the client trim, OR ask the server to give
      // us all sent and we mark visually. For v1, only pass the persisted
      // statuses through the filter.
      status:
        statusFilter === 'all' || statusFilter === 'overdue'
          ? undefined
          : statusFilter,
      businessUnit: currentBU !== 'all' ? currentBU : undefined,
    }),
    [page, debouncedSearch, statusFilter, currentBU],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, currentBU]);

  const query = useInvoicesList(filters);

  const buColor = (key: string) =>
    businessUnits.find((bu) => bu.key === key)?.color ?? '#64748b';
  const buName = (key: string) => businessUnits.find((bu) => bu.key === key)?.name ?? key;

  const allItems = query.data?.items ?? [];
  // Client-side filter for the computed "overdue" status.
  const items: Invoice[] =
    statusFilter === 'overdue' ? allItems.filter((i) => i.isOverdue) : allItems;

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = !!debouncedSearch || statusFilter !== 'all';

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice number or title…"
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
              {INVOICE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/invoices/new">
            <Plus className="size-4" />
            New invoice
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
      ) : items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filtersActive ? 'No matching invoices' : 'No invoices yet'}
          description={
            filtersActive
              ? 'Clear your filters or create a new invoice.'
              : 'Create your first invoice from a case detail page or here.'
          }
          action={
            !filtersActive ? (
              <Button asChild size="sm" className="gap-2">
                <Link href="/invoices/new">
                  <Plus className="size-4" />
                  New invoice
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[130px] text-right">Total</TableHead>
                <TableHead className="w-[140px]">Business unit</TableHead>
                <TableHead className="w-[120px]">Due</TableHead>
                <TableHead className="w-[120px]">Issued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((inv) => (
                <TableRow
                  key={inv._id}
                  onClick={() => router.push(`/invoices/${inv._id}`)}
                  className="cursor-pointer hover:bg-muted/40"
                >
                  <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{inv.clientSnapshot?.name ?? '—'}</div>
                    {inv.title && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {inv.title}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrency(inv.total, inv.currency)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: buColor(inv.businessUnit) }}
                      />
                      <span>{buName(inv.businessUnit)}</span>
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-xs tabular-nums',
                      inv.isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {formatDate(inv.dueDate)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(inv.issueDate)}
                  </TableCell>
                </TableRow>
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
