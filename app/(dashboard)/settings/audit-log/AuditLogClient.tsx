'use client';

import { History, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AuditLogDetailSheet } from '@/components/settings/AuditLogDetailSheet';
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
import { useAuditLogsList } from '@/hooks/useAuditLogs';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { AUDIT_ACTIONS, AUDIT_SOURCES } from '@/lib/constants/enums';
import { cn } from '@/lib/utils';
import type { AuditLog, AuditLogListFilters } from '@/types/auditLog';
import { AUDITED_COLLECTIONS } from '@/types/auditLog';

const COLLECTION_LABELS: Record<string, string> = {
  users: 'Users',
  businessUnits: 'Business units',
  contacts: 'Contacts',
  leads: 'Leads',
  cases: 'Cases',
  tasks: 'Tasks',
  documents: 'Documents',
  calendarEvents: 'Calendar events',
  invoices: 'Invoices',
  smartLists: 'Smart lists',
  caseChecklists: 'Case checklists',
  pipelineStages: 'Pipeline stages',
  settings: 'Settings',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  restore: 'Restored',
};

const ACTION_BADGE_CLASS: Record<string, string> = {
  create: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  update: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  delete: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  restore: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

const SOURCE_LABELS: Record<string, string> = {
  user: 'User',
  system: 'System',
  webhook: 'Webhook',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditLogClient() {
  const { businessUnits } = useBusinessUnit();

  const [collectionName, setCollectionName] = useState<string>('all');
  const [action, setAction] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [businessUnit, setBusinessUnit] = useState<string>('all');
  const [actorEmail, setActorEmail] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [active, setActive] = useState<AuditLog | null>(null);

  const debouncedActor = useDebouncedValue(actorEmail, 300);

  const filters: AuditLogListFilters = useMemo(
    () => ({
      collectionName: collectionName === 'all' ? undefined : collectionName,
      action: action === 'all' ? undefined : (action as AuditLogListFilters['action']),
      source: source === 'all' ? undefined : (source as AuditLogListFilters['source']),
      businessUnit: businessUnit === 'all' ? undefined : businessUnit,
      actorEmail: debouncedActor.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: 25,
    }),
    [collectionName, action, source, businessUnit, debouncedActor, from, to],
  );

  const query = useAuditLogsList(filters);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const filtersActive =
    collectionName !== 'all' ||
    action !== 'all' ||
    source !== 'all' ||
    businessUnit !== 'all' ||
    !!debouncedActor ||
    !!from ||
    !!to;

  function clearFilters() {
    setCollectionName('all');
    setAction('all');
    setSource('all');
    setBusinessUnit('all');
    setActorEmail('');
    setFrom('');
    setTo('');
  }

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={collectionName} onValueChange={setCollectionName}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Collection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All collections</SelectItem>
              {AUDITED_COLLECTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {COLLECTION_LABELS[c] ?? c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {AUDIT_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={businessUnit} onValueChange={setBusinessUnit}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Business unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All BUs</SelectItem>
              {businessUnits.map((bu) => (
                <SelectItem key={bu.key} value={bu.key}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: bu.color }}
                    />
                    {bu.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={actorEmail}
              onChange={(e) => setActorEmail(e.target.value)}
              placeholder="Actor email contains…"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-[11px] text-muted-foreground">From</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-[11px] text-muted-foreground">To</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-[150px]"
            />
          </div>
          {filtersActive && (
            <Button variant="ghost" size="sm" className="gap-1" onClick={clearFilters}>
              <X className="size-3" />
              Clear filters
            </Button>
          )}
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
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title={filtersActive ? 'No matching entries' : 'No audit entries yet'}
          description={
            filtersActive
              ? 'Try widening your filters or clearing them.'
              : 'Every mutation across the CRM is recorded here. Entries are kept for 180 days.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">When</TableHead>
                <TableHead className="w-[110px]">Action</TableHead>
                <TableHead className="w-[160px]">Collection</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="w-[130px]">Business unit</TableHead>
                <TableHead className="w-[90px] text-right">Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry) => {
                const buColor =
                  businessUnits.find((bu) => bu.key === entry.businessUnit)?.color ?? '#64748b';
                const buName =
                  businessUnits.find((bu) => bu.key === entry.businessUnit)?.name ??
                  entry.businessUnit;
                return (
                  <TableRow
                    key={entry._id}
                    onClick={() => setActive(entry)}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTimestamp(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('whitespace-nowrap', ACTION_BADGE_CLASS[entry.action])}
                      >
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {COLLECTION_LABELS[entry.collectionName] ?? entry.collectionName}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {entry.documentId}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.actorEmail ? (
                        <span>{entry.actorEmail}</span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          {SOURCE_LABELS[entry.source] ?? entry.source}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.businessUnit ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: buColor }}
                          />
                          <span>{buName}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {entry.changes.length}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

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

      {active && (
        <AuditLogDetailSheet
          entry={active}
          open={!!active}
          onOpenChange={(o) => !o && setActive(null)}
        />
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
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
