'use client';

import { CheckSquare, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  TaskPriorityDot,
  TaskStatusBadge,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '@/components/tasks/TaskBadges';
import { TaskCreateDialog } from '@/components/tasks/TaskCreateDialog';
import { TaskDeleteAlert } from '@/components/tasks/TaskDeleteAlert';
import { TaskEditSheet } from '@/components/tasks/TaskEditSheet';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useTasksList, useUpdateTask } from '@/hooks/useTasks';
import { ApiError } from '@/lib/utils/apiFetch';
import { toast } from 'sonner';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/constants/enums';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/task';

const PAGE_SIZE = 25;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

const RELATED_HREF: Record<string, string> = {
  lead: '/leads',
  case: '/cases',
  contact: '/contacts',
};

export function TasksClient() {
  const { currentBU, businessUnits } = useBusinessUnit();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const update = useUpdateTask();
  async function toggle(task: Task) {
    try {
      await update.mutateAsync({
        id: task._id,
        patch: { status: task.status === 'done' ? 'todo' : 'done' },
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to update task';
      toast.error(msg);
    }
  }

  const debouncedSearch = useDebouncedValue(search, 300);

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      overdue: overdueOnly || undefined,
      businessUnit: currentBU !== 'all' ? currentBU : undefined,
    }),
    [page, debouncedSearch, statusFilter, priorityFilter, overdueOnly, currentBU],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, priorityFilter, overdueOnly, currentBU]);

  const query = useTasksList(filters);

  const buColor = (key: string) => businessUnits.find((bu) => bu.key === key)?.color ?? '#64748b';
  const buName = (key: string) => businessUnits.find((bu) => bu.key === key)?.name ?? key;

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive =
    !!debouncedSearch || statusFilter !== 'all' || priorityFilter !== 'all' || overdueOnly;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or description…"
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            Overdue only
          </Label>
        </div>
        <TaskCreateDialog
          trigger={
            <Button size="sm" className="gap-2">
              <Plus className="size-4" />
              New task
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
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={filtersActive ? 'No matching tasks' : 'No tasks yet'}
          description={
            filtersActive
              ? 'Clear your filters or create a new task.'
              : 'Create your first task — add follow-ups, deadlines, or todos.'
          }
          action={
            !filtersActive ? (
              <TaskCreateDialog
                trigger={
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" />
                    New task
                  </Button>
                }
              />
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[68px]" />
                <TableHead>Title</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[100px]">Priority</TableHead>
                <TableHead className="w-[120px]">Due</TableHead>
                <TableHead className="w-[140px]">Related</TableHead>
                <TableHead className="w-[120px]">Business unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data!.items.map((t) => {
                const overdue = isOverdue(t);
                return (
                  <TableRow
                    key={t._id}
                    onClick={() => setEditing(t)}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={t.status === 'done'}
                          onChange={() => toggle(t)}
                          onClick={(e) => e.stopPropagation()}
                          className="size-4 rounded border-border accent-primary"
                          aria-label={`Mark "${t.title}" ${t.status === 'done' ? 'incomplete' : 'done'}`}
                        />
                        <TaskPriorityDot priority={t.priority} />
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'font-medium',
                        t.status === 'done' && 'text-muted-foreground line-through',
                      )}
                    >
                      {t.title}
                    </TableCell>
                    <TableCell>
                      <TaskStatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {TASK_PRIORITY_LABELS[t.priority]}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-xs tabular-nums',
                        overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {formatDate(t.dueDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.relatedTo ? (
                        <Link
                          href={`${RELATED_HREF[t.relatedTo.type] ?? '/'}/${t.relatedTo.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="capitalize underline-offset-2 hover:underline"
                        >
                          {t.relatedTo.type}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ backgroundColor: buColor(t.businessUnit) }}
                        />
                        <span>{buName(t.businessUnit)}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
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
        <TaskEditSheet
          task={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      {deleting && (
        <TaskDeleteAlert
          task={deleting}
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
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
