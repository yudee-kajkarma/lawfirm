'use client';

import { KeyRound, Pencil, Plus, Search, ShieldCheck, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { SetPasswordDialog } from '@/components/settings/SetPasswordDialog';
import { UserEditSheet } from '@/components/settings/UserEditSheet';
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
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useUsersList } from '@/hooks/useUsers';
import type { User } from '@/types/user';

const PAGE_SIZE = 25;

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function UsersClient() {
  const { businessUnits } = useBusinessUnit();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | null>(null);
  const [settingPassword, setSettingPassword] = useState<User | null>(null);

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

  const query = useUsersList(filters);

  const buName = (key: string) => businessUnits.find((bu) => bu.key === key)?.name ?? key;
  const buColor = (key: string) => businessUnits.find((bu) => bu.key === key)?.color ?? '#64748b';

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(debouncedSearch) || activeFilter !== 'active';

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
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
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/settings/users/new">
            <Plus className="size-4" />
            New user
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
          title={filtersActive ? 'No matching users' : 'No users yet'}
          description={
            filtersActive
              ? 'Try clearing your filters.'
              : 'Add your first teammate to get them into the CRM.'
          }
          action={
            !filtersActive ? (
              <Button asChild size="sm" className="gap-2">
                <Link href="/settings/users/new">
                  <Plus className="size-4" />
                  New user
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
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[110px]">Role</TableHead>
                <TableHead>Business units</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[130px]">Last login</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data!.items.map((u) => (
                <TableRow key={u._id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {u.isAdmin ? (
                      <Badge className="gap-1">
                        <ShieldCheck className="size-3" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Member</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.isAdmin ? (
                      <span className="text-xs text-muted-foreground">All (admin)</span>
                    ) : u.businessUnits.length === 0 ? (
                      <span className="text-xs text-muted-foreground">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.businessUnits.map((bu) => (
                          <span
                            key={bu}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px]"
                          >
                            <span
                              className="inline-block size-1.5 rounded-full"
                              style={{ backgroundColor: buColor(bu) }}
                            />
                            {buName(bu)}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
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
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(u.lastLoginAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setSettingPassword(u)}
                        aria-label="Set password"
                        title="Set password"
                      >
                        <KeyRound className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditing(u)}
                        aria-label="Edit"
                        title="Edit user"
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
        <UserEditSheet
          user={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      {settingPassword && (
        <SetPasswordDialog
          user={settingPassword}
          open={!!settingPassword}
          onOpenChange={(o) => !o && setSettingPassword(null)}
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
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
