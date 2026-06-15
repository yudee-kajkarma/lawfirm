'use client';

import { Building2, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  useOperatorTenantsList,
  type OperatorTenantsListFilters,
} from '@/hooks/useOperatorTenants';
import { cn } from '@/lib/utils';
import type { OperatorTenantListItem } from '@/types/operator';
import type { TenantStatus } from '@/lib/models/Tenant';

const STATUS_BADGE: Record<TenantStatus, string> = {
  active: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  suspended: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  pending_purge: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  purging: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

const STATUS_LABELS: Record<TenantStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  pending_purge: 'Pending purge',
  purging: 'Purging',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function TenantsClient() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const filters: OperatorTenantsListFilters = useMemo(
    () => ({
      status: status === 'all' ? undefined : status,
      search: debouncedSearch.trim() || undefined,
      limit: 25,
    }),
    [status, debouncedSearch],
  );

  const query = useOperatorTenantsList(filters);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = items.length;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Tenants</h1>
          {query.isSuccess && (
            <p className="text-sm text-muted-foreground">
              {total} tenant{total !== 1 ? 's' : ''} visible
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="pending_purge">Pending purge</SelectItem>
            <SelectItem value="purging">Purging</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, slug, email…"
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
          icon={Building2}
          title="No tenants found"
          description={
            status !== 'all' || debouncedSearch
              ? 'Try widening your filters.'
              : 'No tenants have been created yet.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[130px]">Slug</TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead>Owner email</TableHead>
                <TableHead className="w-[80px] text-right">Users</TableHead>
                <TableHead className="w-[120px]">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((tenant) => (
                <TenantRow key={tenant._id} tenant={tenant} />
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
            <span className="text-xs text-muted-foreground">All tenants loaded.</span>
          )}
        </div>
      )}
    </div>
  );
}

function TenantRow({ tenant }: { tenant: OperatorTenantListItem }) {
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell>
        <Link
          href={`/admin/tenants/${tenant._id}`}
          className="font-medium hover:underline"
        >
          {tenant.name}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">{tenant.slug}</TableCell>
      <TableCell>
        <Badge variant="outline" className={cn('whitespace-nowrap', STATUS_BADGE[tenant.status])}>
          {STATUS_LABELS[tenant.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">{tenant.ownerEmail}</TableCell>
      <TableCell className="text-right tabular-nums text-sm">{tenant.userCount}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDate(tenant.createdAt)}</TableCell>
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
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="ml-auto h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
