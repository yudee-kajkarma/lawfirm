'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchedulePurge } from '@/hooks/useOperatorTenants';

type Props = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  /** ISO date string of when the tenant was suspended; used to compute purge date. */
  suspendedAt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PURGE_GRACE_DAYS = 30;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatPurgeDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function SchedulePurgeConfirmDialog({
  tenantId,
  tenantSlug,
  tenantName,
  suspendedAt,
  open,
  onOpenChange,
}: Props) {
  const [confirmation, setConfirmation] = useState('');
  const schedulePurge = useSchedulePurge();
  const isMatch = confirmation === tenantSlug;

  // Show the computed purge date based on suspension time so the operator can
  // see exactly when the irreversible deletion will be triggered.
  const purgeDate = suspendedAt
    ? addDays(new Date(suspendedAt), PURGE_GRACE_DAYS)
    : addDays(new Date(), PURGE_GRACE_DAYS);

  async function handleConfirm() {
    try {
      await schedulePurge.mutateAsync(tenantId);
      toast.success(`Purge scheduled for ${tenantName}`);
      onOpenChange(false);
      setConfirmation('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule purge');
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) setConfirmation('');
    onOpenChange(open);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Schedule purge for {tenantName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will schedule all tenant data (users, cases, leads, documents, and all other
            records) for permanent deletion on{' '}
            <strong>{formatPurgeDate(purgeDate)}</strong> — {PURGE_GRACE_DAYS} days from suspension.
            This is reversible during the grace window by cancelling the purge. After the purge
            runs, data cannot be recovered.{' '}
            Type <code className="rounded bg-muted px-1">{tenantSlug}</code> to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="purge-confirm">Tenant slug</Label>
          <Input
            id="purge-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoFocus
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!isMatch || schedulePurge.isPending}
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {schedulePurge.isPending ? 'Scheduling…' : 'Schedule purge'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
