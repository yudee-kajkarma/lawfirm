'use client';

import { Plus, Search, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ContactCreateDialog } from '@/components/contacts/ContactCreateDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { SmartListPicker } from '@/components/smart-lists/SmartListPicker';
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
import { useContactsList } from '@/hooks/useContacts';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CONTACT_TYPES, type ContactType } from '@/lib/constants/enums';
import type { Contact } from '@/types/contact';

const PAGE_SIZE = 25;

const TYPE_VARIANTS: Record<ContactType, 'default' | 'secondary' | 'outline'> = {
  client: 'default',
  prospect: 'secondary',
  witness: 'outline',
  vendor: 'outline',
  other: 'outline',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ContactsClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { currentBU, businessUnits } = useBusinessUnit();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ContactType>('all');
  const [page, setPage] = useState(1);

  // Debounce so we don't fire a query on every keystroke.
  const debouncedSearch = useDebouncedValue(search, 300);
  const smartListId = sp.get('smartListId') ?? undefined;

  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      contactType: typeFilter === 'all' ? undefined : typeFilter,
      businessUnit: currentBU !== 'all' ? currentBU : undefined,
      smartListId,
    }),
    [page, debouncedSearch, typeFilter, currentBU, smartListId],
  );

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, currentBU, smartListId]);

  const query = useContactsList(filters);

  const buColor = (key: string) => businessUnits.find((bu) => bu.key === key)?.color ?? '#64748b';
  const buName = (key: string) => businessUnits.find((bu) => bu.key === key)?.name ?? key;

  const total = query.data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 p-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, company…"
              className="pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {CONTACT_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SmartListPicker entity="contact" />
        </div>
        <ContactCreateDialog
          trigger={
            <Button size="sm" className="gap-2">
              <Plus className="size-4" />
              New contact
            </Button>
          }
        />
      </div>

      {/* Table / states */}
      {query.isLoading ? (
        <TableSkeleton />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title={debouncedSearch || typeFilter !== 'all' ? 'No matching contacts' : 'No contacts yet'}
          description={
            debouncedSearch || typeFilter !== 'all'
              ? 'Try clearing your filters or searching for something different.'
              : 'Create your first contact to get started.'
          }
          action={
            !debouncedSearch && typeFilter === 'all' ? (
              <ContactCreateDialog
                trigger={
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" />
                    New contact
                  </Button>
                }
              />
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead className="w-[160px]">Business unit</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[140px]">Phone</TableHead>
                <TableHead className="w-[120px]">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data!.items.map((c) => (
                <ContactRow
                  key={c._id}
                  contact={c}
                  buColor={buColor(c.businessUnit)}
                  buName={buName(c.businessUnit)}
                  onClick={() => router.push(`/contacts/${c._id}`)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
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

function ContactRow({
  contact,
  buColor,
  buName,
  onClick,
}: {
  contact: Contact;
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
      <TableCell className="font-medium">
        {contact.firstName} {contact.lastName}
      </TableCell>
      <TableCell>
        <Badge variant={TYPE_VARIANTS[contact.contactType]} className="capitalize">
          {contact.contactType}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="inline-block size-2 rounded-full" style={{ backgroundColor: buColor }} />
          <span>{buName}</span>
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {contact.companyName ?? '—'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{contact.email ?? '—'}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{contact.phone ?? '—'}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDate(contact.createdAt)}</TableCell>
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
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

