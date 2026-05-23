'use client';

import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  Pencil,
  Sparkles,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CaseChecklistCard } from '@/components/cases/CaseChecklistCard';
import { CaseDeleteAlert } from '@/components/cases/CaseDeleteAlert';
import { CaseEditSheet } from '@/components/cases/CaseEditSheet';
import { CaseStatusBadge } from '@/components/cases/CaseStatusBadge';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { TasksPanel } from '@/components/tasks/TasksPanel';
import { Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useCase } from '@/hooks/useCases';
import { useContact } from '@/hooks/useContacts';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatValue(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function CaseDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { businessUnits } = useBusinessUnit();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const caseQuery = useCase(id);
  const c = caseQuery.data;
  const clientQuery = useContact(c?.clientId ?? null);

  if (caseQuery.isLoading) return <DetailSkeleton />;

  if (caseQuery.isError || !c) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1"
          onClick={() => router.push('/cases')}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">
            {(caseQuery.error as Error)?.message ?? 'Case not found.'}
          </p>
        </div>
      </div>
    );
  }

  const bu = businessUnits.find((b) => b.key === c.businessUnit);
  const client = clientQuery.data;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1 text-muted-foreground"
            onClick={() => router.push('/cases')}
          >
            <ArrowLeft className="size-3.5" />
            All cases
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">{c.caseNumber}</span>
            <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
            <CaseStatusBadge status={c.status} />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: bu?.color ?? '#64748b' }}
              />
              {bu?.name ?? c.businessUnit}
            </span>
          </div>
          {c.caseType && (
            <p className="text-sm text-muted-foreground">
              <Tag className="mr-1 inline-block size-3" /> {c.caseType}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link
              href={`/invoices/new?${new URLSearchParams({
                clientId: c.clientId,
                caseId: c._id,
                businessUnit: c.businessUnit,
                title: `${c.caseNumber} — ${c.title}`,
              }).toString()}`}
            >
              <Receipt className="size-3.5" />
              Create invoice
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Case details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <InfoField icon={Briefcase} label="Case number" value={c.caseNumber} mono />
              <InfoField icon={Building2} label="Business unit" value={bu?.name ?? c.businessUnit} />
              <InfoField icon={Tag} label="Case type" value={c.caseType} />
              <InfoField icon={DollarSign} label="Value" value={formatValue(c.value)} />
              <InfoField icon={Calendar} label="Opened" value={formatDate(c.openedAt)} />
              <InfoField icon={Calendar} label="Closed" value={formatDate(c.closedAt)} />
            </dl>
            {c.description && (
              <div className="mt-6 border-t pt-4">
                <dt className="text-xs text-muted-foreground">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm">{c.description}</dd>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent>
            {clientQuery.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : !client ? (
              <p className="text-sm text-muted-foreground">Client unavailable.</p>
            ) : (
              <Link
                href={`/contacts/${client._id}`}
                className="group flex items-center gap-3 rounded-md p-2 hover:bg-muted/40"
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                  <User className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {client.firstName} {client.lastName}
                  </div>
                  {client.email && (
                    <div className="truncate text-xs text-muted-foreground">{client.email}</div>
                  )}
                </div>
                <ExternalLink className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </Link>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <CaseChecklistCard caseId={c._id} />
        </div>

        <div className="lg:col-span-1">
          <TasksPanel relatedToType="case" relatedToId={c._id} businessUnit={c.businessUnit} />
        </div>

        <div className="lg:col-span-3">
          <DocumentsPanel relatedToType="case" relatedToId={c._id} businessUnit={c.businessUnit} />
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <InfoField icon={Calendar} label="Created" value={formatDateTime(c.createdAt)} />
              <InfoField icon={Calendar} label="Updated" value={formatDateTime(c.updatedAt)} />
              {c.convertedFromLead && (
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 size-3.5 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Converted from</dt>
                    <dd>
                      <Link
                        href={`/leads/${c.convertedFromLead}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        View source lead
                      </Link>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      <CaseEditSheet caseDoc={c} open={editOpen} onOpenChange={setEditOpen} />
      <CaseDeleteAlert
        caseDoc={c}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push('/cases')}
      />
    </div>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof User;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={`truncate font-medium ${mono ? 'font-mono text-xs' : ''}`}>
          {value || '—'}
        </dd>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-96" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
