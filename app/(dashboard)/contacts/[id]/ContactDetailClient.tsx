'use client';

import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Mail,
  Pencil,
  Phone,
  Trash2,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ContactDeleteAlert } from '@/components/contacts/ContactDeleteAlert';
import { ContactEditSheet } from '@/components/contacts/ContactEditSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useContact } from '@/hooks/useContacts';
import type { ContactType } from '@/lib/constants/enums';

const TYPE_VARIANTS: Record<ContactType, 'default' | 'secondary' | 'outline'> = {
  client: 'default',
  prospect: 'secondary',
  witness: 'outline',
  vendor: 'outline',
  other: 'outline',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ContactDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { businessUnits } = useBusinessUnit();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const query = useContact(id);

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError || !query.data) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1"
          onClick={() => router.push('/contacts')}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">
            {(query.error as Error)?.message ?? 'Contact not found.'}
          </p>
        </div>
      </div>
    );
  }

  const c = query.data;
  const bu = businessUnits.find((b) => b.key === c.businessUnit);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1 text-muted-foreground"
            onClick={() => router.push('/contacts')}
          >
            <ArrowLeft className="size-3.5" />
            All contacts
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {c.firstName} {c.lastName}
            </h1>
            <Badge variant={TYPE_VARIANTS[c.contactType]} className="capitalize">
              {c.contactType}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: bu?.color ?? '#64748b' }}
              />
              {bu?.name ?? c.businessUnit}
            </span>
          </div>
          {c.companyName && (
            <p className="text-sm text-muted-foreground">
              {c.jobTitle ? `${c.jobTitle} · ` : ''}
              {c.companyName}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
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

      {/* Body */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Contact information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <InfoField icon={User} label="Name" value={`${c.firstName} ${c.lastName}`} />
              <InfoField icon={Building2} label="Business unit" value={bu?.name ?? c.businessUnit} />
              <InfoField icon={Mail} label="Email" value={c.email} />
              <InfoField icon={Phone} label="Phone" value={c.phone} />
              <InfoField icon={Briefcase} label="Company" value={c.companyName} />
              <InfoField icon={Briefcase} label="Job title" value={c.jobTitle} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <InfoField icon={Calendar} label="Created" value={formatDate(c.createdAt)} />
              <InfoField icon={Calendar} label="Updated" value={formatDate(c.updatedAt)} />
            </dl>
          </CardContent>
        </Card>

        {c.notes && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Activity placeholder — real timeline arrives in Phase 10 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Communications, tasks, and timeline events appear here in Phase 10.
          </p>
        </CardContent>
      </Card>

      {/* Drawer + alert */}
      <ContactEditSheet contact={c} open={editOpen} onOpenChange={setEditOpen} />
      <ContactDeleteAlert
        contact={c}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push('/contacts')}
      />
    </div>
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
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
