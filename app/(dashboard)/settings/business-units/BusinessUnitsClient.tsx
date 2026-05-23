'use client';

import { Building2, Pencil, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { BusinessUnitEditSheet } from '@/components/settings/BusinessUnitEditSheet';
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
import { useBusinessUnitsList } from '@/hooks/useBusinessUnits';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { BusinessUnit } from '@/types/businessUnit';

const PAGE_SIZE = 25;

export function BusinessUnitsClient() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BusinessUnit | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      isActive: activeFilter,
    }),
    [page, debouncedSearch, activeFilter],
  );

  const query = useBusinessUnitsList(filters);

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(debouncedSearch) || activeFilter !== 'all';

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search key, name…"
              className="pl-8"
            />
          </div>
          <Select
            value={activeFilter}
            onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/settings/business-units/new">
            <Plus className="size-4" />
            New business unit
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
          icon={Building2}
          title={filtersActive ? 'No matching business units' : 'No business units yet'}
          description={
            filtersActive
              ? 'Try clearing your filters.'
              : 'Create your first business unit to segment records.'
          }
          action={
            !filtersActive ? (
              <Button asChild size="sm" className="gap-2">
                <Link href="/settings/business-units/new">
                  <Plus className="size-4" />
                  New business unit
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
                <TableHead className="w-[60px]" />
                <TableHead className="w-[180px]">Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[80px] text-right">Order</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data!.items.map((bu) => (
                <TableRow key={bu._id} className="hover:bg-muted/40">
                  <TableCell>
                    <span
                      className="inline-block size-4 rounded"
                      style={{ backgroundColor: bu.color }}
                      title={bu.color}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{bu.key}</TableCell>
                  <TableCell className="font-medium">{bu.name}</TableCell>
                  <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                    {bu.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{bu.order}</TableCell>
                  <TableCell>
                    {bu.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditing(bu)}
                        aria-label="Edit"
                        title="Edit business unit"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
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

      {editing && (
        <BusinessUnitEditSheet
          businessUnit={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
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
            <Skeleton className="size-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
