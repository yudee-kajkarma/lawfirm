'use client';

import { Building2, ChevronsUpDown, Search, Sparkles, User, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
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
import { useLead, useLeadsList } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/contact';
import type { Lead } from '@/types/lead';

export type ClientSelection =
  | { kind: 'contact'; id: string; businessUnit: string; displayName: string }
  | { kind: 'lead'; id: string; businessUnit: string; displayName: string };

type Props = {
  value: { kind: 'contact' | 'lead'; id: string } | null;
  onChange: (selection: ClientSelection) => void;
  /** Restrict candidates to a single BU. */
  businessUnit?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function ClientPicker({
  value,
  onChange,
  businessUnit,
  disabled,
  placeholder = 'Select contact or lead…',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  // Resolve currently-selected entity for the button label.
  const selectedContact = useContact(value?.kind === 'contact' ? value.id : null);
  const selectedLead = useLead(value?.kind === 'lead' ? value.id : null);

  const contactsFilters = useMemo(
    () => ({
      limit: 15,
      search: debouncedSearch || undefined,
      businessUnit,
    }),
    [debouncedSearch, businessUnit],
  );
  const contactsQuery = useContactsList(contactsFilters);

  const leadsFilters = useMemo(
    () => ({
      limit: 25,
      search: debouncedSearch || undefined,
      businessUnit,
    }),
    [debouncedSearch, businessUnit],
  );
  const leadsQuery = useLeadsList(leadsFilters);

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const contacts = contactsQuery.data?.items ?? [];
  // Hide already-converted leads — they have a case already.
  const leads = (leadsQuery.data?.items ?? []).filter((l) => l.stage !== 'converted').slice(0, 15);
  const isLoading = contactsQuery.isLoading || leadsQuery.isLoading;
  const empty = contacts.length === 0 && leads.length === 0;

  const buttonLabel =
    value?.kind === 'contact' && selectedContact.data
      ? displayName(selectedContact.data)
      : value?.kind === 'lead' && selectedLead.data
        ? displayName(selectedLead.data)
        : null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full justify-between font-normal"
      >
        <span
          className={cn('flex min-w-0 items-center gap-2', !buttonLabel && 'text-muted-foreground')}
        >
          <span className="truncate">{buttonLabel ?? placeholder}</span>
          {value?.kind === 'lead' && (
            <Badge variant="secondary" className="shrink-0 gap-1 px-1.5 py-0 text-[10px]">
              <Sparkles className="size-2.5" />
              Lead
            </Badge>
          )}
        </span>
        <ChevronsUpDown className="size-3.5 flex-shrink-0 opacity-60" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select client</DialogTitle>
            <DialogDescription>
              {businessUnit
                ? `Showing contacts and leads in ${businessUnit}.`
                : 'Showing contacts and leads across your business units.'}{' '}
              Picking a lead will convert it to a client when the case is created.
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

          <div className="max-h-96 space-y-3 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : empty ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {debouncedSearch
                  ? `Nothing matches "${debouncedSearch}".`
                  : 'No contacts or leads in this business unit yet.'}
              </p>
            ) : (
              <>
                {contacts.length > 0 && (
                  <Section title="Contacts">
                    {contacts.map((c) => {
                      const isActive = value?.kind === 'contact' && value.id === c._id;
                      return (
                        <PickerRow
                          key={c._id}
                          icon={<User className="size-3.5 text-muted-foreground" />}
                          name={displayName(c)}
                          companyName={c.companyName}
                          email={c.email}
                          active={isActive}
                          onClick={() => {
                            onChange({
                              kind: 'contact',
                              id: c._id,
                              businessUnit: c.businessUnit,
                              displayName: displayName(c),
                            });
                            setOpen(false);
                          }}
                        />
                      );
                    })}
                  </Section>
                )}
                {leads.length > 0 && (
                  <Section
                    title="Leads"
                    hint="Will be converted to a client on case creation."
                  >
                    {leads.map((l) => {
                      const isActive = value?.kind === 'lead' && value.id === l._id;
                      return (
                        <PickerRow
                          key={l._id}
                          icon={<Sparkles className="size-3.5 text-amber-500" />}
                          name={displayName(l)}
                          companyName={l.companyName}
                          email={l.email}
                          active={isActive}
                          onClick={() => {
                            onChange({
                              kind: 'lead',
                              id: l._id,
                              businessUnit: l.businessUnit,
                              displayName: displayName(l),
                            });
                            setOpen(false);
                          }}
                        />
                      );
                    })}
                  </Section>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="px-2 pt-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        {hint && <div className="text-[11px] text-muted-foreground/80">{hint}</div>}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function PickerRow({
  icon,
  name,
  companyName,
  email,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  name: string;
  companyName: string | null;
  email: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted/60',
          active && 'bg-primary/5 ring-1 ring-primary/30',
        )}
      >
        <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {companyName && (
              <>
                <Building2 className="size-3" />
                <span className="truncate">{companyName}</span>
                {email && <span>·</span>}
              </>
            )}
            {email && <span className="truncate">{email}</span>}
          </div>
        </div>
      </button>
    </li>
  );
}

function displayName(p: Contact | Lead): string {
  return `${p.firstName} ${p.lastName}`.trim();
}
