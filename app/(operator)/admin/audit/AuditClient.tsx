'use client';

import { ScrollText, Search } from 'lucide-react';
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
import { useOperatorAuditList, type OperatorAuditListFilters } from '@/hooks/useOperatorAudit';
import { OPERATOR_AUDIT_ACTIONS, type OperatorAuditAction } from '@/lib/constants/enums';
import { cn } from '@/lib/utils';
import type { OperatorAuditEntry } from '@/types/operator';

const ACTION_LABEL: Record<OperatorAuditAction, string> = {
  login: 'Login',
  suspend_tenant: 'Suspend tenant',
  reactivate_tenant: 'Reactivate tenant',
  schedule_purge: 'Schedule purge',
  cancel_purge: 'Cancel purge',
};

// Colour tokens that match semantic meaning of each action.
const ACTION_BADGE: Record<OperatorAuditAction, string> = {
  login: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  suspend_tenant: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  reactivate_tenant:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  schedule_purge: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  cancel_purge: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateDetails(details: Record<string, unknown> | null): string {
  if (!details) return '—';
  const str = JSON.stringify(details);
  return str.length > 80 ? `${str.slice(0, 80)}…` : str;
}

export function AuditClient() {
  const [action, setAction] = useState('all');
  const [operatorEmail, setOperatorEmail] = useState('');
  const debouncedEmail = useDebouncedValue(operatorEmail, 300);

  const filters: OperatorAuditListFilters = useMemo(
    () => ({
      action: action === 'all' ? undefined : action,
      operatorEmail: debouncedEmail.trim() || undefined,
      limit: 25,
    }),
    [action, debouncedEmail],
  );

  const query = useOperatorAuditList(filters);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Operator Audit</h1>
        <p className="text-sm text-muted-foreground">
          All platform-level operator actions are recorded here.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {OPERATOR_AUDIT_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABEL[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={operatorEmail}
            onChange={(e) => setOperatorEmail(e.target.value)}
            placeholder="Operator email contains…"
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
          icon={ScrollText}
          title="No audit entries found"
          description={
            action !== 'all' || debouncedEmail
              ? 'Try widening your filters.'
              : 'Operator actions will appear here once they occur.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">When</TableHead>
                <TableHead className="w-[160px]">Action</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead className="w-[160px]">Target tenant</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry) => (
                <AuditRow key={entry._id} entry={entry} />
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
            <span className="text-xs text-muted-foreground">No more entries.</span>
          )}
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: OperatorAuditEntry }) {
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="text-xs text-muted-foreground">
        {formatTimestamp(entry.createdAt)}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn('whitespace-nowrap', ACTION_BADGE[entry.action])}
        >
          {ACTION_LABEL[entry.action]}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">{entry.operatorEmail}</TableCell>
      <TableCell className="text-sm">
        {entry.targetTenantId && entry.targetTenantSlug ? (
          <Link
            href={`/admin/tenants/${entry.targetTenantId}`}
            className="font-mono hover:underline"
          >
            {entry.targetTenantSlug}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-[260px] truncate font-mono text-xs text-muted-foreground">
        {truncateDetails(entry.details)}
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
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="ml-auto h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
