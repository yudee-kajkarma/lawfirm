'use client';

import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  ExternalLink,
  Pencil,
  Trash2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { InvoiceActions } from '@/components/invoices/InvoiceActions';
import { InvoiceDeleteAlert } from '@/components/invoices/InvoiceDeleteAlert';
import { InvoiceEditSheet } from '@/components/invoices/InvoiceEditSheet';
import { InvoicePdfButton } from '@/components/invoices/InvoicePdfButton';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { formatCurrency, formatDate } from '@/components/invoices/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useInvoice } from '@/hooks/useInvoices';

export function InvoiceDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { businessUnits } = useBusinessUnit();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const query = useInvoice(id);

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError || !query.data) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1"
          onClick={() => router.push('/invoices')}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">
            {(query.error as Error)?.message ?? 'Invoice not found.'}
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

  const inv = query.data;
  const bu = businessUnits.find((b) => b.key === inv.businessUnit);
  const canEdit = inv.persistedStatus === 'draft';
  const canDelete = inv.persistedStatus === 'draft' || inv.persistedStatus === 'void';

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1 text-muted-foreground"
            onClick={() => router.push('/invoices')}
          >
            <ArrowLeft className="size-3.5" />
            All invoices
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {inv.title ?? 'Untitled invoice'}
            </h1>
            <InvoiceStatusBadge status={inv.status} />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: bu?.color ?? '#64748b' }}
              />
              {bu?.name ?? inv.businessUnit}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <InvoicePdfButton invoice={inv} />
          <InvoiceActions invoice={inv} />
          {canEdit && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Line items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[80px] text-right">Qty</TableHead>
                  <TableHead className="w-[120px] text-right">Unit price</TableHead>
                  <TableHead className="w-[120px] text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inv.lineItems.map((li, i) => (
                  <TableRow key={i}>
                    <TableCell>{li.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{li.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(li.unitPrice, inv.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(li.amount, inv.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
              <Row label="Subtotal" value={formatCurrency(inv.subtotal, inv.currency)} />
              {inv.discountAmount > 0 && (
                <Row
                  label={`Discount (${inv.discountPercent}%)`}
                  value={`−${formatCurrency(inv.discountAmount, inv.currency)}`}
                  muted
                />
              )}
              {inv.taxAmount > 0 && (
                <Row
                  label={`Tax (${inv.taxRate}%)`}
                  value={formatCurrency(inv.taxAmount, inv.currency)}
                  muted
                />
              )}
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(inv.total, inv.currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill to</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Link
              href={`/contacts/${inv.clientId}`}
              className="group flex items-center gap-3 rounded-md p-2 hover:bg-muted/40"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-secondary">
                <User className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{inv.clientSnapshot?.name ?? '—'}</div>
                {inv.clientSnapshot?.email && (
                  <div className="truncate text-xs text-muted-foreground">
                    {inv.clientSnapshot.email}
                  </div>
                )}
              </div>
              <ExternalLink className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </Link>
            {inv.clientSnapshot?.companyName && (
              <div className="flex items-start gap-2 px-2">
                <Building2 className="mt-0.5 size-3.5 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">
                  {inv.clientSnapshot.companyName}
                </div>
              </div>
            )}
            {inv.caseId && (
              <Link
                href={`/cases/${inv.caseId}`}
                className="group flex items-center gap-3 rounded-md border border-dashed border-border p-2 hover:bg-muted/40"
              >
                <Briefcase className="size-4 text-muted-foreground" />
                <span className="flex-1 text-xs text-muted-foreground">Linked to a case</span>
                <ExternalLink className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field icon={Calendar} label="Issued" value={formatDate(inv.issueDate)} />
            <Field
              icon={Calendar}
              label="Due"
              value={formatDate(inv.dueDate)}
              valueClass={inv.isOverdue ? 'font-medium text-destructive' : ''}
            />
            {inv.sentAt && <Field icon={Calendar} label="Sent" value={formatDate(inv.sentAt)} />}
            {inv.paidAt && <Field icon={Calendar} label="Paid" value={formatDate(inv.paidAt)} />}
            {inv.voidedAt && (
              <Field icon={Calendar} label="Voided" value={formatDate(inv.voidedAt)} />
            )}
          </CardContent>
        </Card>

        {(inv.notes || inv.internalNotes) && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inv.notes && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    On the invoice
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{inv.notes}</p>
                </div>
              )}
              {inv.internalNotes && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Internal
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {inv.internalNotes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <InvoiceEditSheet invoice={inv} open={editOpen} onOpenChange={setEditOpen} />
      <InvoiceDeleteAlert
        invoice={inv}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push('/invoices')}
      />
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div
      className={
        muted ? 'flex justify-between text-muted-foreground' : 'flex justify-between'
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: typeof User;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`font-medium ${valueClass ?? ''}`}>{value}</div>
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
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
