'use client';

import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  DollarSign,
  Flag,
  Mail,
  Pencil,
  Phone,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { humanizeEnum } from '@/components/leads/LeadForm';
import { LeadConvertDialog } from '@/components/leads/LeadConvertDialog';
import { LeadDeleteAlert } from '@/components/leads/LeadDeleteAlert';
import { LeadEditSheet } from '@/components/leads/LeadEditSheet';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { TasksPanel } from '@/components/tasks/TasksPanel';
import { StageBadge } from '@/app/(dashboard)/leads/LeadsClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useLead } from '@/hooks/useLeads';
import Link from 'next/link';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
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

export function LeadDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { businessUnits } = useBusinessUnit();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const query = useLead(id);

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError || !query.data) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1"
          onClick={() => router.push('/leads')}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">
            {(query.error as Error)?.message ?? 'Lead not found.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => query.refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const l = query.data;
  const bu = businessUnits.find((b) => b.key === l.businessUnit);
  const isConverted = l.stage === 'converted';

  return (
    <>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 gap-1 text-muted-foreground"
              onClick={() => router.push('/leads')}
            >
              <ArrowLeft className="size-3.5" />
              All leads
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {l.firstName} {l.lastName}
              </h1>
              <StageBadge stage={l.stage} />
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: bu?.color ?? '#64748b' }}
                />
                {bu?.name ?? l.businessUnit}
              </span>
            </div>
            {l.companyName && (
              <p className="text-sm text-muted-foreground">
                {l.jobTitle ? `${l.jobTitle} · ` : ''}
                {l.companyName}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isConverted && l.convertedToCase ? (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href={`/cases/${l.convertedToCase}`}>
                  <Sparkles className="size-3.5" />
                  View case
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setConvertOpen(true)}
              >
                <Sparkles className="size-3.5" />
                Convert to case
              </Button>
            )}
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
              <CardTitle className="text-base">Lead details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <InfoField icon={User} label="Name" value={`${l.firstName} ${l.lastName}`} />
                <InfoField icon={Building2} label="Business unit" value={bu?.name ?? l.businessUnit} />
                <InfoField icon={Mail} label="Email" value={l.email} />
                <InfoField icon={Phone} label="Phone" value={l.phone} />
                <InfoField icon={Flag} label="Source" value={humanizeEnum(l.source)} />
                <InfoField icon={Flag} label="Stage" value={humanizeEnum(l.stage)} />
                <InfoField icon={Briefcase} label="Company" value={l.companyName} />
                <InfoField icon={Briefcase} label="Job title" value={l.jobTitle} />
                <InfoField icon={DollarSign} label="Estimated value" value={formatValue(l.value)} />
                <InfoField icon={Calendar} label="Expected close" value={formatDate(l.expectedCloseDate)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <InfoField icon={Calendar} label="Created" value={formatDateTime(l.createdAt)} />
                <InfoField icon={Calendar} label="Updated" value={formatDateTime(l.updatedAt)} />
                {isConverted && l.convertedAt && (
                  <InfoField icon={Sparkles} label="Converted" value={formatDateTime(l.convertedAt)} />
                )}
              </dl>
            </CardContent>
          </Card>

          {l.notes && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{l.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <TasksPanel relatedToType="lead" relatedToId={l._id} businessUnit={l.businessUnit} />

        <DocumentsPanel relatedToType="lead" relatedToId={l._id} businessUnit={l.businessUnit} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Communications and stage changes appear here in Phase 10.
            </p>
          </CardContent>
        </Card>

        <LeadEditSheet lead={l} open={editOpen} onOpenChange={setEditOpen} />
        <LeadDeleteAlert
          lead={l}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => router.push('/leads')}
        />
        <LeadConvertDialog lead={l} open={convertOpen} onOpenChange={setConvertOpen} />
      </div>
    </>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium">{value || '—'}</dd>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
