'use client';

import { useRouter } from 'next/navigation';
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
import { usePurgeNow } from '@/hooks/useOperatorTenants';

type Props = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  /** When true, labels the button "Resume purge" — used when status === 'purging'. */
  isResume?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PurgeNowConfirmDialog({
  tenantId,
  tenantSlug,
  tenantName,
  isResume = false,
  open,
  onOpenChange,
}: Props) {
  const [confirmation, setConfirmation] = useState('');
  const purgeNow = usePurgeNow();
  const router = useRouter();
  const isMatch = confirmation === tenantSlug;

  async function handleConfirm() {
    try {
      await purgeNow.mutateAsync(tenantId);
      toast.success('Tenant purged. Signed report saved.');
      onOpenChange(false);
      setConfirmation('');
      router.push('/admin/purge-reports');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Purge failed');
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmation('');
    onOpenChange(next);
  }

  const actionLabel = isResume ? 'Resume purge' : 'Purge now';
  const pendingLabel = isResume ? 'Resuming…' : 'Purging…';

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently purge {tenantName}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="font-semibold text-destructive">
                This action is IRREVERSIBLE. There is no undo.
              </p>
              <p>Proceeding will permanently delete:</p>
              <ul className="ml-4 list-disc space-y-1 text-sm">
                <li>All leads, cases, and contacts</li>
                <li>All documents and S3 objects</li>
                <li>All users belonging to this tenant</li>
                <li>All tasks, invoices, and calendar events</li>
                <li>All communications, threads, and messages</li>
              </ul>
              <p>
                A signed purge report will be saved for audit purposes. Type{' '}
                <code className="rounded bg-muted px-1">{tenantSlug}</code> to confirm.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="purge-now-confirm">Tenant slug</Label>
          <Input
            id="purge-now-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoFocus
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!isMatch || purgeNow.isPending}
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {purgeNow.isPending ? pendingLabel : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
