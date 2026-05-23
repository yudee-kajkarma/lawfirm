'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSetUserPassword } from '@/hooks/useUsers';
import { ApiError } from '@/lib/utils/apiFetch';
import type { User } from '@/types/user';

type Props = {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SetPasswordDialog({ user, open, onOpenChange }: Props) {
  const setPassword = useSetUserPassword();
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');

    try {
      await setPassword.mutateAsync({ id: user._id, password });
      toast.success(`Password set for ${user.name}`);
      setPasswordValue('');
      setConfirm('');
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to set password';
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set password</DialogTitle>
          <DialogDescription>
            Share the new password with <span className="font-medium">{user.name}</span> ({user.email}).
            They&apos;ll use it on their next login.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">New password</Label>
            <div className="relative">
              <Input
                type={show ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Minimum 8 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Confirm</Label>
            <Input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={setPassword.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={setPassword.isPending}>
              {setPassword.isPending ? 'Saving…' : 'Set password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
