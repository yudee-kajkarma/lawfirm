'use client';

import { ExternalLink, Filter, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { SmartListCreateSheet } from '@/components/smart-lists/SmartListCreateSheet';
import { SmartListDeleteAlert } from '@/components/smart-lists/SmartListDeleteAlert';
import { SmartListEditSheet } from '@/components/smart-lists/SmartListEditSheet';
import { summarizeFilterTree } from '@/components/smart-lists/filterSummary';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useSmartLists } from '@/hooks/useSmartLists';
import {
  SMART_LIST_ENTITIES,
  type SmartListEntity,
} from '@/lib/utils/smartListFields';
import type { SmartList } from '@/types/smartList';

const ENTITY_LABELS: Record<SmartListEntity, string> = {
  lead: 'Leads',
  case: 'Cases',
  contact: 'Contacts',
  task: 'Tasks',
};

const ENTITY_HREF: Record<SmartListEntity, string> = {
  lead: '/leads',
  case: '/cases',
  contact: '/contacts',
  task: '/tasks',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SmartListsClient() {
  const { currentBU, businessUnits } = useBusinessUnit();
  const [entityFilter, setEntityFilter] = useState<'all' | SmartListEntity>('all');
  const [editing, setEditing] = useState<SmartList | null>(null);
  const [deleting, setDeleting] = useState<SmartList | null>(null);

  const filters = useMemo(
    () => ({
      entity: entityFilter === 'all' ? undefined : entityFilter,
      businessUnit: currentBU !== 'all' ? currentBU : undefined,
    }),
    [entityFilter, currentBU],
  );
  const query = useSmartLists(filters);

  const buColor = (key: string) => businessUnits.find((bu) => bu.key === key)?.color ?? '#64748b';
  const buName = (key: string) => businessUnits.find((bu) => bu.key === key)?.name ?? key;

  const items = query.data ?? [];

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={entityFilter}
          onValueChange={(v) => setEntityFilter(v as typeof entityFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {SMART_LIST_ENTITIES.map((e) => (
              <SelectItem key={e} value={e}>
                {ENTITY_LABELS[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SmartListCreateSheet
          trigger={
            <Button size="sm" className="gap-2">
              <Plus className="size-4" />
              New smart list
            </Button>
          }
        />
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
          icon={Filter}
          title={entityFilter === 'all' ? 'No smart lists yet' : `No ${ENTITY_LABELS[entityFilter]} smart lists`}
          description="Smart lists save complex filter combinations as reusable views. Create one from any entity list page or here."
          action={
            <SmartListCreateSheet
              defaultEntity={entityFilter === 'all' ? 'lead' : entityFilter}
              trigger={
                <Button size="sm" className="gap-2">
                  <Plus className="size-4" />
                  New smart list
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[100px]">Entity</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead className="w-[140px]">Business unit</TableHead>
                <TableHead className="w-[110px]">Created</TableHead>
                <TableHead className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((sl) => (
                <TableRow key={sl._id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="font-medium">{sl.name}</div>
                    {sl.description && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{sl.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {sl.entity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={summarizeFilterTree(sl.filterTree, sl.entity)}>
                    {summarizeFilterTree(sl.filterTree, sl.entity)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: buColor(sl.businessUnit) }}
                      />
                      <span>{buName(sl.businessUnit)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(sl.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Apply"
                        title="Apply to entity list"
                      >
                        <Link href={`${ENTITY_HREF[sl.entity]}?smartListId=${sl._id}`}>
                          <ExternalLink className="size-3.5 text-muted-foreground" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditing(sl)}
                        aria-label="Edit"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setDeleting(sl)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <SmartListEditSheet
          smartList={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      {deleting && (
        <SmartListDeleteAlert
          smartList={deleting}
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
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
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="ml-auto h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
