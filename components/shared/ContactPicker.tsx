'use client';

import { Building2, ChevronsUpDown, Search, User, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useContact, useContactsList } from '@/hooks/useContacts';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/contact';

type Props = {
  value: string | null;
  onChange: (id: string, contact: Contact) => void;
  /** Restrict candidates to a single BU. */
  businessUnit?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function ContactPicker({
  value,
  onChange,
  businessUnit,
  disabled,
  placeholder = 'Select contact…',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  // Resolve the currently-selected contact's display name. Cached by id so
  // re-opening the picker doesn't re-fetch.
  const selectedQuery = useContact(value);

  const listFilters = useMemo(
    () => ({
      limit: 25,
      search: debouncedSearch || undefined,
      businessUnit,
    }),
    [debouncedSearch, businessUnit],
  );
  const listQuery = useContactsList(listFilters);

  // Reset search when picker opens — fresh start each time.
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const selected = selectedQuery.data;
  const items = listQuery.data?.items ?? [];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full justify-between font-normal"
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? displayName(selected) : placeholder}
        </span>
        <ChevronsUpDown className="size-3.5 flex-shrink-0 opacity-60" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select contact</DialogTitle>
            <DialogDescription>
              {businessUnit
                ? `Showing contacts in ${businessUnit}.`
                : 'Showing contacts across all your business units.'}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search name, email, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {debouncedSearch
                  ? `No contacts match "${debouncedSearch}"`
                  : 'No contacts found in this business unit.'}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {items.map((c) => {
                  const isActive = c._id === value;
                  return (
                    <li key={c._id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(c._id, c);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted/60',
                          isActive && 'bg-primary/5 ring-1 ring-primary/30',
                        )}
                      >
                        <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
                          <User className="size-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{displayName(c)}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {c.companyName && (
                              <>
                                <Building2 className="size-3" />
                                <span className="truncate">{c.companyName}</span>
                                {c.email && <span>·</span>}
                              </>
                            )}
                            {c.email && <span className="truncate">{c.email}</span>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function displayName(c: Contact): string {
  return `${c.firstName} ${c.lastName}`.trim();
}
