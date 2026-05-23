'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUpdateUser } from '@/hooks/useUsers';
import { ApiError } from '@/lib/utils/apiFetch';
import type { User } from '@/types/user';

type Props = {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UserEditSheet({ user, open, onOpenChange }: Props) {
  const update = useUpdateUser();
  const { businessUnits } = useBusinessUnit();
  const { user: actor } = useCurrentUser();
  const isSelf = actor?.id === user._id;

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);
  const [isActive, setIsActive] = useState(user.isActive);
  const [buKeys, setBuKeys] = useState<string[]>(user.businessUnits);
  const [error, setError] = useState<string | null>(null);

  function toggleBU(key: string) {
    setBuKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name is required');
    if (!email.trim()) return setError('Email is required');

    try {
      await update.mutateAsync({
        id: user._id,
        patch: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          isAdmin,
          isActive,
          businessUnits: isAdmin ? [] : buKeys,
        },
      });
      toast.success('User updated');
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to update user';
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit user</SheetTitle>
          <SheetDescription>
            {user.email}
            {isSelf && (
              <span className="ml-1 text-amber-700 dark:text-amber-400">— this is you</span>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Name<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Email<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Used as the login identifier.</p>
            </div>

            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium">Admin</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Full access to settings and every business unit.
                  </p>
                </div>
                <Switch
                  checked={isAdmin}
                  onCheckedChange={setIsAdmin}
                  disabled={isSelf}
                  aria-label="Toggle admin"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium">Active</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Inactive users cannot log in.
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={isSelf}
                  aria-label="Toggle active"
                />
              </div>
              {isSelf && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  You cannot toggle Admin or Active on your own account.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Business unit access</Label>
              {isAdmin ? (
                <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Admins automatically see every business unit. Per-BU access only matters for
                  non-admin users.
                </p>
              ) : businessUnits.length === 0 ? (
                <p className="text-xs text-muted-foreground">No business units configured.</p>
              ) : (
                <ul className="space-y-1.5">
                  {businessUnits.map((bu) => (
                    <li key={bu.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`bu-${bu.key}`}
                        checked={buKeys.includes(bu.key)}
                        onCheckedChange={() => toggleBU(bu.key)}
                      />
                      <Label
                        htmlFor={`bu-${bu.key}`}
                        className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                      >
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ backgroundColor: bu.color }}
                        />
                        {bu.name}
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
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
  );
}
