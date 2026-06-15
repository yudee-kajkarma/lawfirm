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
import { useSuspendTenant } from '@/hooks/useOperatorTenants';

type Props = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SuspendConfirmDialog({
  tenantId,
  tenantSlug,
  tenantName,
  open,
  onOpenChange,
}: Props) {
  const [confirmation, setConfirmation] = useState('');
  const suspend = useSuspendTenant();
  const isMatch = confirmation === tenantSlug;

  async function handleConfirm() {
    try {
      await suspend.mutateAsync(tenantId);
      toast.success(`Suspended ${tenantName}`);
      onOpenChange(false);
      setConfirmation('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suspension failed');
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
          <AlertDialogTitle>Suspend {tenantName}?</AlertDialogTitle>
          <AlertDialogDescription>
            All users of this tenant will be unable to sign in or use the app until you reactivate
            them. Type <code className="rounded bg-muted px-1">{tenantSlug}</code> to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="suspend-confirm">Tenant slug</Label>
          <Input
            id="suspend-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoFocus
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!isMatch || suspend.isPending}
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {suspend.isPending ? 'Suspending…' : 'Suspend'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
