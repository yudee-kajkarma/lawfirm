'use client';

import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { SchedulePurgeConfirmDialog } from '@/components/operator/SchedulePurgeConfirmDialog';
import { SuspendConfirmDialog } from '@/components/operator/SuspendConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCancelPurge, useOperatorTenant, useReactivateTenant } from '@/hooks/useOperatorTenants';
import { cn } from '@/lib/utils';
import type { TenantStatus } from '@/lib/models/Tenant';

type Props = { tenantId: string };

const STATUS_BADGE: Record<TenantStatus, string> = {
  active: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  suspended: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  pending_purge: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  purging: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
};

const STATUS_LABELS: Record<TenantStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  pending_purge: 'Pending purge',
  purging: 'Purging',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TenantDetailClient({ tenantId }: Props) {
  const query = useOperatorTenant(tenantId);
  const reactivate = useReactivateTenant();
  const cancelPurge = useCancelPurge();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{(query.error as Error).message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!query.data) return null;

  const { tenant, businessUnits, counts } = query.data;
  const status = tenant.status;

  async function handleReactivate() {
    try {
      await reactivate.mutateAsync(tenantId);
      toast.success(`Reactivated ${tenant.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reactivation failed');
    }
  }

  async function handleCancelPurge() {
    try {
      await cancelPurge.mutateAsync(tenantId);
      toast.success(`Purge cancelled for ${tenant.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel purge');
    }
  }

  const purgeScheduledAt = tenant.purgeScheduledAt ? new Date(tenant.purgeScheduledAt) : null;
  const purgeIsFuture = purgeScheduledAt ? purgeScheduledAt > new Date() : false;

  return (
    <div className="space-y-6 p-6">
      {/* Back link */}
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All tenants
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="font-mono text-sm text-muted-foreground">{tenant.slug}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className={cn(STATUS_BADGE[status])}>
              {STATUS_LABELS[status]}
            </Badge>
            <span className="text-xs text-muted-foreground">{tenant.ownerEmail}</span>
          </div>
        </div>

        {/* Action buttons based on current status */}
        <div className="flex flex-wrap items-center gap-2">
          {status === 'active' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setSuspendOpen(true)}
            >
              Suspend tenant
            </Button>
          )}

          {status === 'suspended' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReactivate}
                disabled={reactivate.isPending}
              >
                {reactivate.isPending ? 'Reactivating…' : 'Reactivate'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setPurgeOpen(true)}
              >
                Schedule purge
              </Button>
            </>
          )}

          {status === 'pending_purge' && (
            <>
              {purgeScheduledAt && (
                <p className="text-xs text-muted-foreground">
                  Purge scheduled for {formatDate(purgeScheduledAt.toISOString())}
                </p>
              )}
              {purgeIsFuture && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelPurge}
                  disabled={cancelPurge.isPending}
                >
                  {cancelPurge.isPending ? 'Cancelling…' : 'Cancel purge'}
                </Button>
              )}
            </>
          )}

          {status === 'purging' && (
            <div className="flex items-center gap-2 rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm text-violet-700 dark:text-violet-300">
              <AlertTriangle className="size-3.5" />
              Purge in progress
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Users" value={counts.users} />
        <StatCard label="Leads (total)" value={counts.leadsTotal} sub={`${counts.leads7d} in 7d`} />
        <StatCard label="Cases (total)" value={counts.casesTotal} sub={`${counts.cases7d} in 7d`} />
        <StatCard label="Contacts" value={counts.contactsTotal} />
        <StatCard label="Invoices" value={counts.invoicesTotal} />
      </div>

      {/* Business units */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Business units</h2>
        {businessUnits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No business units configured.</p>
        ) : (
          <ul className="space-y-2">
            {businessUnits.map((bu) => (
              <li key={bu._id} className="flex items-center gap-3">
                <span
                  className="inline-block size-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: bu.color }}
                  aria-hidden
                />
                <span className="flex-1 text-sm font-medium">{bu.name}</span>
                <code className="font-mono text-xs text-muted-foreground">{bu.key}</code>
                {!bu.isActive && (
                  <Badge variant="outline" className="text-[10px]">
                    Inactive
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Meta */}
      <p className="text-xs text-muted-foreground">
        Tenant created {formatDate(tenant.createdAt)}
      </p>

      {/* Dialogs */}
      <SuspendConfirmDialog
        tenantId={tenantId}
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
      />
      <SchedulePurgeConfirmDialog
        tenantId={tenantId}
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        suspendedAt={tenant.suspendedAt}
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
      />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-4 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
