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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateBusinessUnit } from '@/hooks/useBusinessUnits';
import { ApiError } from '@/lib/utils/apiFetch';
import type { BusinessUnit } from '@/types/businessUnit';

type AffectedUser = { _id: string; name: string; email: string };

type Props = {
  businessUnit: BusinessUnit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BusinessUnitEditSheet({ businessUnit, open, onOpenChange }: Props) {
  const router = useRouter();
  const update = useUpdateBusinessUnit();

  const [name, setName] = useState(businessUnit.name);
  const [description, setDescription] = useState(businessUnit.description ?? '');
  const [color, setColor] = useState(businessUnit.color);
  const [order, setOrder] = useState(String(businessUnit.order));
  const [isActive, setIsActive] = useState(businessUnit.isActive);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeactivation, setPendingDeactivation] = useState<{
    affectedUsers: AffectedUser[];
  } | null>(null);

  function patchPayload() {
    return {
      name: name.trim(),
      description: description.trim() || null,
      color,
      order: Number(order) || 0,
      isActive,
    };
  }

  async function save(force: boolean) {
    try {
      await update.mutateAsync({
        id: businessUnit._id,
        patch: patchPayload(),
        force,
      });
      toast.success(`${name.trim()} updated`);
      // Dashboard layout reads BUs server-side and passes them down. A refresh
      // pulls the new name/color/active state into the BU selector without
      // forcing a full reload.
      router.refresh();
      setPendingDeactivation(null);
      onOpenChange(false);
    } catch (e) {
      // Soft guard: server flagged users who'd lose all UI access. Surface a
      // confirmation dialog with the names so admin can decide.
      if (
        e instanceof ApiError &&
        e.code === 'BU_HAS_SOLE_ACCESS_USERS' &&
        typeof e.details === 'object' &&
        e.details !== null
      ) {
        const details = e.details as { affectedUsers?: AffectedUser[] };
        setPendingDeactivation({ affectedUsers: details.affectedUsers ?? [] });
        return;
      }
      const msg = e instanceof ApiError ? e.message : 'Failed to update business unit';
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name is required');
    await save(false);
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit business unit</SheetTitle>
          <SheetDescription>
            Key <span className="font-mono">{businessUnit.key}</span> cannot be changed.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Key</Label>
              <Input value={businessUnit.key} disabled className="font-mono" />
              <p className="text-[11px] text-muted-foreground">
                Locked — every record references this string.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Name<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What kinds of cases or work this unit handles."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent p-1"
                    aria-label="Pick color"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#1d4ed8"
                    className="flex-1 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Order</Label>
                <Input
                  type="number"
                  min={0}
                  max={9999}
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Lower numbers appear first.</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-3">
              <div>
                <Label className="text-xs font-medium">Active</Label>
                <p className="text-[11px] text-muted-foreground">
                  Inactive units disappear from the BU selector but their records remain.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Toggle active" />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={update.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
    <AlertDialog
      open={pendingDeactivation !== null}
      onOpenChange={(o) => !o && !update.isPending && setPendingDeactivation(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate this business unit?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {pendingDeactivation?.affectedUsers.length === 1
                  ? '1 active user has this as their only business unit.'
                  : `${pendingDeactivation?.affectedUsers.length ?? 0} active users have this as their only business unit.`}{' '}
                If you proceed, they&rsquo;ll be locked out of the dashboard until you either
                reactivate the unit or grant them access to another one.
              </p>
              {pendingDeactivation && pendingDeactivation.affectedUsers.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
                  {pendingDeactivation.affectedUsers.map((u) => (
                    <li key={u._id} className="flex items-center justify-between gap-2 py-1">
                      <span className="font-medium text-foreground">{u.name}</span>
                      <span className="truncate text-muted-foreground">{u.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={update.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={update.isPending}
            onClick={(e) => {
              e.preventDefault();
              save(true);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {update.isPending ? 'Deactivating…' : 'Deactivate anyway'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
